/*
    Wrappers for ctx.mod operations to enable easier interop between types

    example: setting variable value for an i32 would just be ctx.mod.local.set(idx, value)
    but for a struct attribute it might be ctx.mod.i32.store(ptr, value)
    or for a regular struct it might be ctx.mod.local.set(idx, ptr)

    these will be passed around instead of raw stuff now
    - i.e. VariableInformation should have a MiteType instead of a raw binaryen.Type i think
*/

import binaryen from "binaryen";
import {
    Context,
    InstanceArrayTypeInformation,
    InstanceStructTypeInformation,
    InstanceTypeInformation,
    NullaryOperator,
    UnaryOperator as UnaryOperatorHandler,
    PrimitiveTypeInformation,
    InstancePrimitiveTypeInformation,
    InstanceFunctionTypeInformation,
    InstanceStringTypeInformation
} from "../types/code_gen.js";
import {
    allocate,
    createMiteType,
    FN_PTRS_START,
    fromExpressionRef,
    miteSignatureToBinaryenSignature,
    typeInformationToBinaryen,
    VIRTUALIZED_FUNCTIONS
} from "./utils.js";
import { BinaryOperator, TokenType } from "../types/tokens.js";
import { UnaryOperator } from "../types/nodes.js";

export abstract class MiteType {
    // get the value as a primitive (pointer for structs and arrays, value for locals)
    abstract get(): Primitive;
    // get the value as a binaryen expression (pointer for structs and arrays, value for locals)
    abstract get_expression_ref(): binaryen.ExpressionRef;
    // set the value
    abstract set(value: MiteType): MiteType;
    // access with . operator
    abstract access(accessor: string): MiteType;
    // access with [] operator (this is going to have to be split into two like the above)
    abstract index(index: MiteType): MiteType;
    // call the value as a function
    abstract call(args: MiteType[]): MiteType;
    // abstract call(args: MiteType[]): MiteType;
    abstract sizeof(): number;
    // operators
    abstract operator(operator: UnaryOperator): NullaryOperator;
    abstract operator(operator: BinaryOperator): UnaryOperatorHandler;
    // if it's a global
    abstract readonly is_global: boolean;
    // the type information of the value
    abstract type: InstanceTypeInformation;
}

export abstract class Primitive implements MiteType {
    // prettier-ignore
    static primitives = new Map<string, PrimitiveTypeInformation>([
        ["void", { classification: "primitive", name: "void", sizeof: 0, binaryen_type: binaryen.none }],
        ["bool", { classification: "primitive", name: "bool", sizeof: 4, binaryen_type: binaryen.i32 }],
        ["i8", { classification: "primitive", name: "i8", sizeof: 1, binaryen_type: binaryen.i32 }],
        ["i16", { classification: "primitive", name: "i16", sizeof: 2, binaryen_type: binaryen.i32 }],
        ["i32", { classification: "primitive", name: "i32", sizeof: 4, binaryen_type: binaryen.i32 }],
        ["i64", { classification: "primitive", name: "i64", sizeof: 8, binaryen_type: binaryen.i64 }],
        ["u8", { classification: "primitive", name: "u8", sizeof: 1, binaryen_type: binaryen.i32 }],
        ["u16", { classification: "primitive", name: "u16", sizeof: 2, binaryen_type: binaryen.i32 }],
        ["u32", { classification: "primitive", name: "u32", sizeof: 4, binaryen_type: binaryen.i32 }],
        ["u64", { classification: "primitive", name: "u64", sizeof: 8, binaryen_type: binaryen.i64 }],
        ["f32", { classification: "primitive", name: "f32", sizeof: 4, binaryen_type: binaryen.f32 }],
        ["f64", { classification: "primitive", name: "f64", sizeof: 8, binaryen_type: binaryen.f64 }],
        ["v128", { classification: "primitive", name: "v128", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["i8x16", { classification: "primitive", name: "i8x16", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["u8x16", { classification: "primitive", name: "u8x16", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["i16x8", { classification: "primitive", name: "i16x8", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["u16x8", { classification: "primitive", name: "u16x8", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["i32x4", { classification: "primitive", name: "i32x4", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["u32x4", { classification: "primitive", name: "u32x4", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["f32x4", { classification: "primitive", name: "f32x4", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["i64x2", { classification: "primitive", name: "i64x2", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["u64x2", { classification: "primitive", name: "u64x2", sizeof: 16, binaryen_type: binaryen.v128 }],
        ["f64x2", { classification: "primitive", name: "f64x2", sizeof: 16, binaryen_type: binaryen.v128 }]
    ]);
    static sizeof(type: string) {
        if (!Primitive.primitives.has(type)) throw new Error(`Invalid primitive type ${type}`);
        return Primitive.primitives.get(type)!.sizeof;
    }

    constructor(
        protected readonly ctx: Context,
        public readonly type: InstancePrimitiveTypeInformation,
        public readonly is_global: boolean
    ) {
        if (!Primitive.primitives.has(type.name))
            throw new Error(`Invalid primitive type ${type.name}`);
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(Primitive.sizeof(this.type.name));
    }

    abstract get(): Primitive;

    abstract get_expression_ref(): binaryen.ExpressionRef;

    abstract set(value: MiteType): MiteType;

    access(_: string): MiteType {
        throw new Error("Unable to access properties of a primitive.");
    }

    index(_: MiteType): MiteType {
        throw new Error("Unable to access indices of a primitive.");
    }

    call(_: MiteType[]): MiteType {
        throw new Error("Unable to call a primitive.");
    }

    operator(operator: UnaryOperator): NullaryOperator;
    operator(operator: BinaryOperator): UnaryOperatorHandler;
    operator(operator: UnaryOperator | BinaryOperator): NullaryOperator | UnaryOperatorHandler {
        const un_op = ((
                operation: (value: binaryen.ExpressionRef) => binaryen.ExpressionRef,
                result?: PrimitiveTypeInformation
            ) =>
            (): MiteType => {
                return new TransientPrimitive(
                    this.ctx,
                    result ?? this.type,
                    operation(this.get_expression_ref())
                );
            }).bind(this);

        const bin_op = ((
                operation: (
                    left: binaryen.ExpressionRef,
                    right: binaryen.ExpressionRef
                ) => binaryen.ExpressionRef,
                result?: PrimitiveTypeInformation
            ) =>
            (other: MiteType): MiteType => {
                if (
                    this.type.name !== other.type.name ||
                    this.type.classification !== "primitive"
                ) {
                    throw new Error(`Cannot operate on ${this.type.name} with ${right.type.name}`);
                }
                return new TransientPrimitive(
                    this.ctx,
                    result ?? this.type,
                    operation(this.get_expression_ref(), other.get_expression_ref())
                );
            }).bind(this);

        const mod = this.ctx.mod;

        switch (this.type.name) {
            case "void":
                throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
            case "bool":
                switch (operator) {
                    case TokenType.NOT:
                        return un_op(mod.i32.eqz, this.ctx.types.bool);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "f32":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.f32.add);
                    case TokenType.MINUS:
                        return bin_op(mod.f32.sub);
                    case TokenType.STAR:
                        return bin_op(mod.f32.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.f32.div);
                    case TokenType.EQUALS:
                        return bin_op(mod.f32.eq, this.ctx.types.bool);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f32.ne, this.ctx.types.bool);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f32.lt, this.ctx.types.bool);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f32.le, this.ctx.types.bool);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f32.gt, this.ctx.types.bool);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f32.ge, this.ctx.types.bool);
                    case TokenType.NOT:
                        return () =>
                            bin_op(
                                mod.f32.eq,
                                this.ctx.types.bool
                            )(
                                new TransientPrimitive(
                                    this.ctx,
                                    this.ctx.types.f32,
                                    mod.f32.const(0)
                                )
                            );
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "f64":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.f64.add);
                    case TokenType.MINUS:
                        return bin_op(mod.f64.sub);
                    case TokenType.STAR:
                        return bin_op(mod.f64.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.f64.div);
                    case TokenType.EQUALS:
                        return bin_op(mod.f64.eq, this.ctx.types.bool);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f64.ne, this.ctx.types.bool);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f64.lt, this.ctx.types.bool);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f64.le, this.ctx.types.bool);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f64.gt, this.ctx.types.bool);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f64.ge, this.ctx.types.bool);
                    case TokenType.NOT:
                        return () =>
                            bin_op(
                                mod.f64.eq,
                                this.ctx.types.bool
                            )(
                                new TransientPrimitive(
                                    this.ctx,
                                    this.ctx.types.f64,
                                    mod.f64.const(0)
                                )
                            );
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "i8":
            case "i16":
            case "i32":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i32.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i32.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i32.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.i32.div_s);
                    case TokenType.EQUALS:
                        return bin_op(mod.i32.eq, this.ctx.types.bool);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32.ne, this.ctx.types.bool);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32.lt_s, this.ctx.types.bool);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32.le_s, this.ctx.types.bool);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32.gt_s, this.ctx.types.bool);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32.ge_s, this.ctx.types.bool);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i32.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i32.shr_s);
                    case TokenType.MODULUS:
                        return bin_op(mod.i32.rem_s);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.i32.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.i32.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.i32.xor);
                    case TokenType.NOT:
                        return un_op(mod.i32.eqz, this.ctx.types.bool);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "u8":
            case "u16":
            case "u32":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i32.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i32.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i32.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.i32.div_u);
                    case TokenType.EQUALS:
                        return bin_op(mod.i32.eq, this.ctx.types.bool);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32.ne, this.ctx.types.bool);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32.lt_u, this.ctx.types.bool);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32.le_u, this.ctx.types.bool);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32.gt_u, this.ctx.types.bool);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32.ge_u, this.ctx.types.bool);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i32.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i32.shr_u);
                    case TokenType.MODULUS:
                        return bin_op(mod.i32.rem_u);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.i32.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.i32.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.i32.xor);
                    case TokenType.NOT:
                        return un_op(mod.i32.eqz, this.ctx.types.bool);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "i64":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i64.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i64.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i64.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.i64.div_s);
                    case TokenType.EQUALS:
                        return bin_op(mod.i64.eq, this.ctx.types.bool);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64.ne, this.ctx.types.bool);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i64.lt_s, this.ctx.types.bool);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i64.le_s, this.ctx.types.bool);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i64.gt_s, this.ctx.types.bool);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i64.ge_s, this.ctx.types.bool);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i64.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i64.shr_s);
                    case TokenType.MODULUS:
                        return bin_op(mod.i64.rem_s);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.i64.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.i64.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.i64.xor);
                    case TokenType.NOT:
                        return un_op(mod.i64.eqz, this.ctx.types.bool);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "u64":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i64.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i64.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i64.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.i64.div_u);
                    case TokenType.EQUALS:
                        return bin_op(mod.i64.eq, this.ctx.types.bool);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64.ne, this.ctx.types.bool);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i64.lt_u, this.ctx.types.bool);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i64.le_u, this.ctx.types.bool);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i64.gt_u, this.ctx.types.bool);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i64.ge_u, this.ctx.types.bool);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i64.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i64.shr_u);
                    case TokenType.MODULUS:
                        return bin_op(mod.i64.rem_u);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.i64.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.i64.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.i64.xor);
                    case TokenType.NOT:
                        return un_op(mod.i64.eqz, this.ctx.types.bool);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "i8x16":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i8x16.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i8x16.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i8x16.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i8x16.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i8x16.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i8x16.lt_s, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i8x16.le_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i8x16.gt_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i8x16.ge_s, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i8x16.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i8x16.shr_s);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "u8x16":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i8x16.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i8x16.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i8x16.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i8x16.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i8x16.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i8x16.lt_u, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i8x16.le_u, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i8x16.gt_u, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i8x16.ge_u, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i8x16.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i8x16.shr_u);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "i16x8":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i16x8.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i16x8.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i16x8.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i16x8.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i16x8.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i16x8.lt_s, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i16x8.le_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i16x8.gt_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i16x8.ge_s, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i16x8.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i16x8.shr_s);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "u16x8":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i16x8.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i16x8.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i16x8.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i16x8.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i16x8.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i16x8.lt_u, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i16x8.le_u, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i16x8.gt_u, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i16x8.ge_u, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i16x8.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i16x8.shr_u);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "i32x4":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i32x4.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i32x4.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i32x4.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i32x4.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32x4.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32x4.lt_s, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32x4.le_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32x4.gt_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32x4.ge_s, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i32x4.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i32x4.shr_s);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "u32x4":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i32x4.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i32x4.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i32x4.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i32x4.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32x4.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32x4.lt_u, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32x4.le_u, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32x4.gt_u, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32x4.ge_u, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i32x4.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i32x4.shr_u);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "i64x2":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i64x2.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i64x2.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i64x2.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i64x2.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64x2.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i64x2.lt_s, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i64x2.le_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i64x2.gt_s, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i64x2.ge_s, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i64x2.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i64x2.shr_s);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "u64x2":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.i64x2.add);
                    case TokenType.MINUS:
                        return bin_op(mod.i64x2.sub);
                    case TokenType.STAR:
                        return bin_op(mod.i64x2.mul);
                    case TokenType.EQUALS:
                        return bin_op(mod.i64x2.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64x2.ne, this.ctx.types.u32x4);
                    case TokenType.BITSHIFT_LEFT:
                        return bin_op(mod.i64x2.shl);
                    case TokenType.BITSHIFT_RIGHT:
                        return bin_op(mod.i64x2.shr_u);
                    case TokenType.BITWISE_AND:
                        return bin_op(mod.v128.and);
                    case TokenType.BITWISE_OR:
                        return bin_op(mod.v128.or);
                    case TokenType.BITWISE_XOR:
                        return bin_op(mod.v128.xor);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "f32x4":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.f32x4.add);
                    case TokenType.MINUS:
                        return bin_op(mod.f32x4.sub);
                    case TokenType.STAR:
                        return bin_op(mod.f32x4.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.f32x4.div);
                    case TokenType.EQUALS:
                        return bin_op(mod.f32x4.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f32x4.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f32x4.lt, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f32x4.le, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f32x4.gt, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f32x4.ge, this.ctx.types.u32x4);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            case "f64x2":
                switch (operator) {
                    case TokenType.PLUS:
                        return bin_op(mod.f64x2.add);
                    case TokenType.MINUS:
                        return bin_op(mod.f64x2.sub);
                    case TokenType.STAR:
                        return bin_op(mod.f64x2.mul);
                    case TokenType.SLASH:
                        return bin_op(mod.f64x2.div);
                    case TokenType.EQUALS:
                        return bin_op(mod.f64x2.eq, this.ctx.types.u32x4);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f64x2.ne, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f64x2.lt, this.ctx.types.u32x4);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f64x2.le, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f64x2.gt, this.ctx.types.u32x4);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f64x2.ge, this.ctx.types.u32x4);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            default:
                throw new Error(
                    `Unable to create binary operations for ${this.type.name} and operator ${operator}`
                );
        }

        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
    }
}

export class TransientPrimitive extends Primitive {
    constructor(
        ctx: Context,
        public readonly type: InstancePrimitiveTypeInformation,
        private readonly expression: binaryen.ExpressionRef
    ) {
        super(ctx, type, false);
    }

    get_expression_ref(): binaryen.ExpressionRef {
        return this.ctx.mod.copyExpression(this.expression);
    }

    get(): Primitive {
        return this;
    }

    set(_: MiteType): MiteType {
        throw new Error("Cannot set transient value");
    }
}

export class LinearMemoryPrimitive extends Primitive {
    constructor(
        ctx: Context,
        type: InstancePrimitiveTypeInformation,
        private readonly pointer: MiteType
    ) {
        super(ctx, type, false);
    }

    get_expression_ref(): binaryen.ExpressionRef {
        return this.get().get_expression_ref();
    }

    get(): Primitive {
        const ptr = this.pointer.get_expression_ref();
        let expr;
        if (this.type.binaryen_type === binaryen.i32) {
            if (this.type.name == "bool") {
                expr = this.ctx.mod.i32.gt_u(
                    this.ctx.mod.i32.load(0, 0, ptr, "main_memory"),
                    this.ctx.mod.i32.const(0)
                );
            } else if (this.type.name === "i8") {
                expr = this.ctx.mod.i32.load8_s(0, 0, ptr, "main_memory");
            } else if (this.type.name === "u8") {
                expr = this.ctx.mod.i32.load8_u(0, 0, ptr, "main_memory");
            } else if (this.type.name === "i16") {
                expr = this.ctx.mod.i32.load16_s(0, 0, ptr, "main_memory");
            } else if (this.type.name === "u16") {
                expr = this.ctx.mod.i32.load16_u(0, 0, ptr, "main_memory");
            } else {
                expr = this.ctx.mod.i32.load(0, 0, ptr, "main_memory");
            }
        } else if (this.type.binaryen_type === binaryen.i64) {
            expr = this.ctx.mod.i64.load(0, 0, ptr, "main_memory");
        } else if (this.type.binaryen_type === binaryen.f32) {
            expr = this.ctx.mod.f32.load(0, 0, ptr, "main_memory");
        } else if (this.type.binaryen_type === binaryen.f64) {
            expr = this.ctx.mod.f64.load(0, 0, ptr, "main_memory");
        } else if (this.type.binaryen_type === binaryen.v128) {
            expr = this.ctx.mod.v128.load(0, 0, ptr, "main_memory");
        } else {
            throw new Error("unreachable");
        }
        return new TransientPrimitive(this.ctx, this.type, expr);
    }

    set(value: MiteType): MiteType {
        if (value.type.name !== this.type.name) {
            throw new Error(`Cannot set ${this.type.name} to ${value.type.name}`);
        }

        let expr;
        const ptr = this.pointer.get_expression_ref();
        const params = [0, 0, ptr, value.get_expression_ref(), "main_memory"] as const;
        // replicate tee behavior
        // TODO: ensure binaryen optimizes out the extra load
        if (this.type.binaryen_type === binaryen.i32) {
            if (this.type.name == "bool") {
                expr = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store(
                        0,
                        0,
                        ptr,
                        this.ctx.mod.i32.gt_u(
                            value.get_expression_ref(),
                            this.ctx.mod.i32.const(0)
                        ),
                        "main_memory"
                    ),
                    this.ctx.mod.i32.load(0, 0, ptr, "main_memory")
                ]);
            } else if (this.type.name === "i8") {
                expr = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store8(...params),
                    this.ctx.mod.i32.load8_s(0, 0, ptr, "main_memory")
                ]);
            } else if (this.type.name === "u8") {
                expr = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store8(...params),
                    this.ctx.mod.i32.load8_u(0, 0, ptr, "main_memory")
                ]);
            } else if (this.type.name === "i16") {
                expr = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store16(...params),
                    this.ctx.mod.i32.load16_s(0, 0, ptr, "main_memory")
                ]);
            } else if (this.type.name === "u16") {
                expr = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store16(...params),
                    this.ctx.mod.i32.load16_u(0, 0, ptr, "main_memory")
                ]);
            } else {
                expr = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store(...params),
                    this.ctx.mod.i32.load(0, 0, ptr, "main_memory")
                ]);
            }
        } else if (this.type.binaryen_type === binaryen.i64) {
            expr = this.ctx.mod.block(null, [
                this.ctx.mod.i64.store(...params),
                this.ctx.mod.i64.load(0, 0, ptr, "main_memory")
            ]);
        } else if (this.type.binaryen_type === binaryen.f32) {
            expr = this.ctx.mod.block(null, [
                this.ctx.mod.f32.store(...params),
                this.ctx.mod.f32.load(0, 0, ptr, "main_memory")
            ]);
        } else if (this.type.binaryen_type === binaryen.f64) {
            expr = this.ctx.mod.block(null, [
                this.ctx.mod.f64.store(...params),
                this.ctx.mod.f64.load(0, 0, ptr, "main_memory")
            ]);
        } else if (this.type.binaryen_type === binaryen.v128) {
            expr = this.ctx.mod.block(null, [
                this.ctx.mod.v128.store(...params),
                this.ctx.mod.v128.load(0, 0, ptr, "main_memory")
            ]);
        } else {
            throw new Error("unreachable");
        }
        return new TransientPrimitive(this.ctx, this.type, expr);
    }
}

export class LocalPrimitive extends Primitive {
    constructor(
        ctx: Context,
        public readonly type: InstancePrimitiveTypeInformation,
        private readonly local_index: number
    ) {
        super(ctx, type, false);
    }

    get_expression_ref(): binaryen.ExpressionRef {
        return this.get().get_expression_ref();
    }

    get(): Primitive {
        let expr = this.ctx.mod.local.get(this.local_index, this.type.binaryen_type);
        if (this.type.name == "bool") {
            expr = this.ctx.mod.i32.gt_u(expr, this.ctx.mod.i32.const(0));
        } else if (this.type.name === "i8") {
            expr = this.ctx.mod.i32.extend8_s(expr);
        } else if (this.type.name === "u8") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xff));
        } else if (this.type.name === "i16") {
            expr = this.ctx.mod.i32.extend16_s(expr);
        } else if (this.type.name === "u16") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xffff));
        }
        return new TransientPrimitive(this.ctx, this.type, expr);
    }

    set(value: MiteType): MiteType {
        if (value.type.name !== this.type.name) {
            throw new Error(`Cannot set ${this.type.name} to ${value.type.name}`);
        }

        let expr = value.get_expression_ref();
        if (this.type.name == "bool") {
            expr = this.ctx.mod.i32.gt_u(expr, this.ctx.mod.i32.const(0));
        } else if (this.type.name === "i8") {
            expr = this.ctx.mod.i32.extend8_s(expr);
        } else if (this.type.name === "u8") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xff));
        } else if (this.type.name === "i16") {
            expr = this.ctx.mod.i32.extend16_s(expr);
        } else if (this.type.name === "u16") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xffff));
        }
        return new TransientPrimitive(
            this.ctx,
            this.type,
            this.ctx.mod.local.tee(this.local_index, expr, this.type.binaryen_type)
        );
    }
}

export class GlobalPrimitive extends Primitive {
    constructor(
        ctx: Context,
        public readonly type: InstancePrimitiveTypeInformation,
        private readonly global_name: string
    ) {
        super(ctx, type, true);

        let zero;
        if (this.type.binaryen_type === binaryen.i32) {
            zero = ctx.mod.i32.const(0);
        } else if (this.type.binaryen_type === binaryen.i64) {
            zero = ctx.mod.i64.const(0, 0);
        } else if (this.type.binaryen_type === binaryen.f32) {
            zero = ctx.mod.f32.const(0);
        } else if (this.type.binaryen_type === binaryen.f64) {
            zero = ctx.mod.f64.const(0);
        } else if (this.type.binaryen_type === binaryen.v128) {
            zero = ctx.mod.v128.const(new Uint8Array(16));
        } else {
            throw new Error(`Invalid binaryen type ${this.type.binaryen_type}`);
        }

        ctx.mod.addGlobal(global_name, this.type.binaryen_type, true, zero);
    }

    get_expression_ref(): binaryen.ExpressionRef {
        return this.get().get_expression_ref();
    }

    get(): Primitive {
        let expr = this.ctx.mod.global.get(this.global_name, this.type.binaryen_type);
        if (this.type.name == "bool") {
            expr = this.ctx.mod.i32.gt_u(expr, this.ctx.mod.i32.const(0));
        } else if (this.type.name === "i8") {
            expr = this.ctx.mod.i32.extend8_s(expr);
        } else if (this.type.name === "u8") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xff));
        } else if (this.type.name === "i16") {
            expr = this.ctx.mod.i32.extend16_s(expr);
        } else if (this.type.name === "u16") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xffff));
        }
        return new TransientPrimitive(this.ctx, this.type, expr);
    }

    set(value: MiteType): MiteType {
        if (value.type.name !== this.type.name) {
            throw new Error(`Cannot set ${this.type.name} to ${value.type.name}`);
        }

        let expr = value.get_expression_ref();
        if (this.type.name == "bool") {
            expr = this.ctx.mod.i32.gt_u(expr, this.ctx.mod.i32.const(0));
        } else if (this.type.name === "i8") {
            expr = this.ctx.mod.i32.extend8_s(expr);
        } else if (this.type.name === "u8") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xff));
        } else if (this.type.name === "i16") {
            expr = this.ctx.mod.i32.extend16_s(expr);
        } else if (this.type.name === "u16") {
            expr = this.ctx.mod.i32.and(expr, this.ctx.mod.i32.const(0xffff));
        }
        return new TransientPrimitive(
            this.ctx,
            this.type,
            this.ctx.mod.block(null, [
                this.ctx.mod.global.set(this.global_name, expr),
                this.ctx.mod.global.get(this.global_name, this.type.binaryen_type)
            ])
        );
    }
}

export class Pointer implements MiteType {
    public static type = Primitive.primitives.get("u32")!;
    public type = Primitive.primitives.get("u32")!;
    public is_global: boolean;

    constructor(private readonly pointer: Primitive) {
        if (pointer.type.name !== "u32") {
            throw new Error("Pointer must be u32");
        }
        this.is_global = pointer.is_global;
    }

    get_expression_ref(): binaryen.ExpressionRef {
        return this.pointer.get_expression_ref();
    }

    get(): Primitive {
        return this.pointer.get();
    }

    set(value: MiteType): MiteType {
        return this.pointer.set(value);
    }

    access(_: string): MiteType {
        throw new Error("Cannot access on pointer value");
    }

    index(_: MiteType): MiteType {
        throw new Error("Cannot index pointer value");
    }

    call(_: MiteType[]): MiteType {
        throw new Error("Cannot call pointer value");
    }

    sizeof(): number {
        return this.pointer.sizeof();
    }

    operator(operator: UnaryOperator): NullaryOperator;
    operator(operator: BinaryOperator): UnaryOperatorHandler;
    operator(operator: UnaryOperator | BinaryOperator): NullaryOperator | UnaryOperatorHandler {
        throw new Error(`Invalid operator ${operator} for pointer`);
    }
}

export abstract class AggregateType<T extends InstanceTypeInformation> implements MiteType {
    public readonly is_global: boolean;

    constructor(
        protected ctx: Context,
        public type: T,
        protected address: Pointer
    ) {
        this.is_global = address.is_global;
    }

    get(): Primitive {
        return new TransientPrimitive(
            this.ctx,
            this.address.type,
            this.address.get_expression_ref()
        );
    }

    get_expression_ref() {
        return this.address.get_expression_ref();
    }

    set(value: MiteType): MiteType {
        if (value instanceof Pointer) {
            return this.address.set(value);
        }

        const value_type = value.type as InstanceTypeInformation;
        if (
            value_type.classification !== this.type.classification ||
            value_type.name !== this.type.name
        ) {
            throw new Error(`Unable to assign ${value_type.name} to ${this.type.name}`);
        }

        if (this.type.is_ref) {
            return this.address.set((value as typeof this).address);
        } else {
            this.ctx.current_block.push(
                new TransientPrimitive(
                    this.ctx,
                    this.ctx.types.void,
                    this.ctx.mod.memory.copy(
                        this.get_expression_ref(),
                        value.get_expression_ref(),
                        this.sizeof(),
                        "main_memory",
                        "main_memory"
                    )
                )
            );
            return this.address;
        }
    }

    access(_: string): MiteType {
        throw new Error("Method not implemented.");
    }

    index(_: MiteType): MiteType {
        throw new Error("Method not implemented.");
    }

    call(_: MiteType[]): MiteType {
        throw new Error("Method not implemented.");
    }

    sizeof(): binaryen.ExpressionRef {
        throw new Error("Method not implemented.");
    }

    operator(operator: UnaryOperator): NullaryOperator;
    operator(operator: BinaryOperator): UnaryOperatorHandler;
    operator(operator: UnaryOperator | BinaryOperator): NullaryOperator | UnaryOperatorHandler {
        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
    }
}

export class Struct extends AggregateType<InstanceStructTypeInformation> {
    access(accessor: string): MiteType {
        if (!this.type.fields.has(accessor) && !this.type.methods.has(accessor)) {
            throw new Error(`Struct ${this.type.name} does not have field or method ${accessor}`);
        }

        if (this.type.fields.has(accessor)) {
            const { type, offset } = this.type.fields.get(accessor)!;

            const addr = new TransientPrimitive(
                this.ctx,
                Pointer.type,
                this.ctx.mod.i32.add(this.get_expression_ref(), this.ctx.mod.i32.const(offset))
            );

            // refs are stored as an address, non-refs are stored contiguously
            if (type.is_ref) {
                return createMiteType(
                    this.ctx,
                    type,
                    new LinearMemoryPrimitive(this.ctx, Pointer.type, addr)
                );
            } else {
                return createMiteType(this.ctx, type, addr);
            }
        } else if (this.type.methods.has(accessor)) {
            return new StructMethod(this.ctx, this.type.methods.get(accessor)!, this);
        } else {
            throw new Error("unreachable");
        }
    }

    index(_: MiteType): MiteType {
        throw new Error("Unable to access indices of a struct.");
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(this.type.sizeof);
    }
}

export class Array_ extends AggregateType<InstanceArrayTypeInformation> {
    access(accessor: string): MiteType {
        if (accessor === "length") {
            return new TransientPrimitive(
                this.ctx,
                this.ctx.types.u32,
                this.ctx.mod.i32.load(0, 0, this.get_expression_ref(), "main_memory")
            );
        }
        throw new Error("Unable to access properties of an array.");
    }

    index(index: MiteType): MiteType {
        if (
            index.type.classification !== "primitive" ||
            (index.type.binaryen_type !== binaryen.i32 && index.type.binaryen_type !== binaryen.i64)
        ) {
            throw new Error(
                `Array index must be an ${Pointer.type.name}, not whatever this is: ${index.type.name}`
            );
        }

        const idx =
            index.type.binaryen_type === binaryen.i64
                ? this.ctx.mod.i32.wrap(index.get_expression_ref())
                : index.get_expression_ref();

        const offset = this.address.sizeof();

        const addr = new TransientPrimitive(
            this.ctx,
            Pointer.type,
            this.ctx.mod.i32.add(
                offset,
                this.ctx.mod.i32.add(
                    this.get_expression_ref(),
                    this.ctx.mod.i32.mul(
                        idx,
                        this.type.element_type.is_ref
                            ? this.ctx.mod.i32.const(Pointer.type.sizeof)
                            : this.ctx.mod.i32.const(this.type.element_type.sizeof)
                    )
                )
            )
        );

        // refs are stored as an address, non-refs are stored contiguously
        if (this.type.element_type.is_ref) {
            return createMiteType(
                this.ctx,
                this.type.element_type,
                new LinearMemoryPrimitive(this.ctx, Pointer.type, addr)
            );
        } else {
            return createMiteType(this.ctx, this.type.element_type, addr);
        }
    }

    sizeof(): number {
        return this.ctx.mod.i32.add(
            this.address.sizeof(),
            this.ctx.mod.i32.mul(
                this.ctx.mod.i32.load(0, 0, this.address.get_expression_ref(), "main_memory"),
                this.ctx.mod.i32.const(this.type.element_type.sizeof)
            )
        );
    }
}

export class DirectFunction implements MiteType {
    public readonly is_global = true;

    constructor(
        private readonly ctx: Context,
        readonly type: InstanceFunctionTypeInformation
    ) {}

    get_expression_ref(): binaryen.ExpressionRef {
        return this.get().get_expression_ref();
    }

    get() {
        const captured_name = `Captured|${this.type.name}`;
        if (this.ctx.captured_functions.indexOf(captured_name) === -1) {
            miteSignatureToBinaryenSignature(
                this.ctx,
                {
                    // dummy parameter for ctx
                    params: [
                        { name: "this", type: Pointer.type },
                        ...this.type.implementation.params
                    ],
                    results: this.type.implementation.results
                },
                captured_name,
                [],
                this.ctx.mod.block(null, [
                    this.ctx.mod.call(
                        this.type.name,
                        this.type.implementation.params.map(({ type }, i) =>
                            this.ctx.mod.local.get(i + 1, typeInformationToBinaryen(type))
                        ),
                        typeInformationToBinaryen(this.type.implementation.results)
                    )
                ])
            );
            this.ctx.captured_functions.push(captured_name);
        }

        const ptr = allocate(
            this.ctx,
            IndirectFunction.struct_type,
            IndirectFunction.struct_type.sizeof
        );

        const func = new IndirectFunction(this.ctx, this.type, ptr);

        this.ctx.current_block.push(
            func.struct
                .access("pointer")
                .set(
                    new TransientPrimitive(
                        this.ctx,
                        Pointer.type,
                        this.ctx.mod.i32.add(
                            this.ctx.mod.i32.const(
                                this.ctx.constants.RESERVED_FN_PTRS +
                                    this.ctx.captured_functions.indexOf(captured_name)
                            ),
                            this.ctx.mod.global.get(FN_PTRS_START, binaryen.i32)
                        )
                    )
                )
        );

        return func.get();
    }

    set(_: MiteType): MiteType {
        throw new Error("Cannot set function value");
    }

    access(_: string): MiteType {
        throw new Error("Cannot access on function value");
    }

    index(_: MiteType): MiteType {
        throw new Error("Cannot index function value");
    }

    call(args: MiteType[]): MiteType {
        const { params, results } = this.type.implementation;
        if (args.length !== params.length) {
            throw new Error(
                `Function ${this.type.name} expects ${params.length} arguments, got ${args.length}`
            );
        }

        const results_expr = this.ctx.mod.call(
            this.type.name,
            args.map((arg) => arg.get_expression_ref()),
            typeInformationToBinaryen(results)
        );

        return fromExpressionRef(this.ctx, results, results_expr);
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(0);
    }

    operator(operator: UnaryOperator): NullaryOperator;
    operator(operator: BinaryOperator): UnaryOperatorHandler;
    operator(operator: UnaryOperator | BinaryOperator): NullaryOperator | UnaryOperatorHandler {
        throw new Error(`Invalid operator ${operator} for function`);
    }
}

export class IndirectFunction extends AggregateType<InstanceFunctionTypeInformation> {
    static struct_type = {
        classification: "struct",
        name: "direct function struct",
        sizeof: Pointer.type.sizeof * 2,
        // prettier-ignore
        fields: new Map([
            ["pointer", { type: Pointer.type, offset: Pointer.type.sizeof * 0, is_ref: false }],
            ["ctx",     { type: Pointer.type, offset: Pointer.type.sizeof * 1, is_ref: false }]
        ]),
        methods: new Map(),
        is_ref: false
    } satisfies InstanceStructTypeInformation;
    readonly struct: Struct;

    constructor(ctx: Context, type: InstanceFunctionTypeInformation, address: Pointer) {
        super(ctx, type, address);
        this.struct = new Struct(ctx, IndirectFunction.struct_type, address);
    }

    call(args: MiteType[]): MiteType {
        const pointer = this.struct.access("pointer").get_expression_ref();
        const ctx = this.struct.access("ctx").get_expression_ref();

        return fromExpressionRef(
            this.ctx,
            this.type.implementation.results,
            this.ctx.mod.call_indirect(
                VIRTUALIZED_FUNCTIONS,
                pointer,
                [ctx, ...args.map((arg) => arg.get_expression_ref())],
                binaryen.createType([
                    binaryen.i32,
                    ...this.type.implementation.params.map((x) => typeInformationToBinaryen(x.type))
                ]),
                typeInformationToBinaryen(this.type.implementation.results)
            )
        );
    }

    sizeof(): binaryen.ExpressionRef {
        return this.ctx.mod.i32.const(IndirectFunction.struct_type.sizeof);
    }
}

export class StructMethod implements MiteType {
    public readonly is_global = true;

    constructor(
        private readonly ctx: Context,
        readonly type: InstanceFunctionTypeInformation,
        readonly this_: Struct
    ) {}

    get_expression_ref(): binaryen.ExpressionRef {
        return this.get().get_expression_ref();
    }

    get() {
        if (this.ctx.captured_functions.indexOf(this.type.name) === -1) {
            this.ctx.captured_functions.push(this.type.name);
        }

        const ptr = allocate(
            this.ctx,
            IndirectFunction.struct_type,
            IndirectFunction.struct_type.sizeof
        );

        const func = new IndirectFunction(this.ctx, this.type, ptr);

        this.ctx.current_block.push(
            func.struct
                .access("pointer")
                .set(
                    new TransientPrimitive(
                        this.ctx,
                        Pointer.type,
                        this.ctx.mod.i32.add(
                            this.ctx.mod.i32.const(
                                this.ctx.constants.RESERVED_FN_PTRS +
                                    this.ctx.captured_functions.indexOf(this.type.name)
                            ),
                            this.ctx.mod.global.get(FN_PTRS_START, binaryen.i32)
                        )
                    )
                ),
            func.struct
                .access("ctx")
                .set(
                    new TransientPrimitive(this.ctx, Pointer.type, this.this_.get_expression_ref())
                )
        );

        return func.get();
    }

    set(_: MiteType): MiteType {
        throw new Error("Cannot set function value");
    }

    access(_: string): MiteType {
        throw new Error("Cannot access on function value");
    }

    index(_: MiteType): MiteType {
        throw new Error("Cannot index function value");
    }

    call(args: MiteType[]): MiteType {
        const { params, results } = this.type.implementation;
        if (args.length !== params.length - 1) {
            throw new Error(
                `Function ${this.type.name} expects ${params.length - 1} arguments, got ${args.length}`
            );
        }

        const results_expr = this.ctx.mod.call(
            this.type.name,
            [this.this_.get_expression_ref(), ...args.map((arg) => arg.get_expression_ref())],
            typeInformationToBinaryen(results)
        );

        return fromExpressionRef(this.ctx, results, results_expr);
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(0);
    }

    operator(operator: UnaryOperator): NullaryOperator;
    operator(operator: BinaryOperator): UnaryOperatorHandler;
    operator(operator: UnaryOperator | BinaryOperator): NullaryOperator | UnaryOperatorHandler {
        throw new Error(`Invalid operator ${operator} for function`);
    }
}

export class String_ extends AggregateType<InstanceStringTypeInformation> {
    array: Array_;
    static type = { classification: "string", name: "string", sizeof: 0, is_ref: true } as const;
    type = String_.type;

    constructor(ctx: Context, address: Pointer) {
        super(ctx, String_.type, address);
        this.array = new Array_(
            ctx,
            {
                classification: "array",
                name: "[u8]",
                sizeof: 0,
                element_type: Primitive.primitives.get("u8")!,
                is_ref: true
            },
            address
        );
    }

    access(accessor: string): MiteType {
        return this.array.access(accessor);
    }

    index(index: MiteType): MiteType {
        return new TransientPrimitive(
            this.ctx,
            this.ctx.types.u32,
            this.array.index(index).get_expression_ref()
        );
    }

    sizeof(): number {
        return this.array.sizeof();
    }

    operator(operator: UnaryOperator): NullaryOperator;
    operator(operator: BinaryOperator): UnaryOperatorHandler;
    operator(operator: UnaryOperator | BinaryOperator): NullaryOperator | UnaryOperatorHandler {
        const cmp = (op: "lt_s" | "gt_s" | "le_s" | "ge_s") => (other: MiteType) =>
            new TransientPrimitive(
                this.ctx,
                this.ctx.types.bool,
                this.ctx.mod.i32[op](
                    this.ctx.mod.call(
                        "String.cmp",
                        [this.get_expression_ref(), other.get_expression_ref()],
                        binaryen.i32
                    ),
                    this.ctx.mod.i32.const(0)
                )
            );

        if (operator === TokenType.PLUS) {
            return (other: MiteType) => {
                return new String_(
                    this.ctx,
                    new Pointer(
                        new TransientPrimitive(
                            this.ctx,
                            Pointer.type,
                            this.ctx.mod.call(
                                "String.concat",
                                [this.get_expression_ref(), other.get_expression_ref()],
                                binaryen.i32
                            )
                        )
                    )
                );
            };
        } else if (operator === TokenType.EQUALS) {
            return (other: MiteType) => {
                return new TransientPrimitive(
                    this.ctx,
                    this.ctx.types.bool,
                    this.ctx.mod.if(
                        this.ctx.mod.i32.eq(
                            this.ctx.mod.i32.load(0, 0, this.get_expression_ref(), "main_memory"),
                            this.ctx.mod.i32.load(0, 0, other.get_expression_ref(), "main_memory")
                        ),
                        this.ctx.mod.i32.eqz(
                            this.ctx.mod.call(
                                "String.cmp",
                                [this.get_expression_ref(), other.get_expression_ref()],
                                binaryen.i32
                            )
                        ),
                        this.ctx.mod.i32.const(0)
                    )
                );
            };
        } else if (operator === TokenType.NOT_EQUALS) {
            const op = this.operator(TokenType.EQUALS);
            return () => this.operator(TokenType.NOT)();
        } else if (operator === TokenType.LESS_THAN) {
            return cmp("lt_s");
        } else if (operator === TokenType.LESS_THAN_EQUALS) {
            return cmp("le_s");
        } else if (operator === TokenType.GREATER_THAN) {
            return cmp("gt_s");
        } else if (operator === TokenType.GREATER_THAN_EQUALS) {
            return cmp("ge_s");
        }

        throw new Error(`Invalid operator ${operator} for strings`);
    }
}
