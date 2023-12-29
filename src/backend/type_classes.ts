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
    ExpressionInformation,
    InstanceArrayTypeInformation,
    InstanceStructTypeInformation,
    InstanceTypeInformation,
    BinaryOperator as BinaryOperatorHandler,
    PrimitiveTypeInformation
} from "../types/code_gen.js";
import { createMiteType } from "./utils.js";
import { BinaryOperator, TokenType } from "../types/tokens.js";

export enum AllocationLocation {
    Local = "local",
    Arena = "arena",
    Stack = "stack",
    JS = "js",
    Table = "table",
    Transient = "transient"
}

export type LinearMemoryLocation = AllocationLocation.Arena | AllocationLocation.JS;

export abstract class MiteType {
    // get the value
    abstract get(): ExpressionInformation;
    // set the value
    abstract set(value: ExpressionInformation): ExpressionInformation;
    // access with . operator
    abstract access(accessor: string): MiteType;
    // access with [] operator (this is going to have to be split into two like the above)
    abstract index(index: ExpressionInformation): MiteType;
    // call (todo for funcrefs)
    // abstract call(args: ExpressionInformation[]): ExpressionInformation;
    abstract sizeof(): number;
    // operators
    abstract operator(operator: BinaryOperator): BinaryOperatorHandler;
    // the type information of the value
    abstract type: InstanceTypeInformation;
}

export class Primitive implements MiteType {
    static primitiveToBinaryen = new Map([
        ["void", binaryen.none],
        ["i32", binaryen.i32],
        ["i64", binaryen.i64],
        ["u32", binaryen.i32],
        ["u64", binaryen.i64],
        ["f32", binaryen.f32],
        ["f64", binaryen.f64],
        ["i8x16", binaryen.v128],
        ["u8x16", binaryen.v128],
        ["i16x8", binaryen.v128],
        ["u16x8", binaryen.v128],
        ["i32x4", binaryen.v128],
        ["u32x4", binaryen.v128],
        ["f32x4", binaryen.v128],
        ["i64x2", binaryen.v128],
        ["u64x2", binaryen.v128],
        ["f64x2", binaryen.v128]
    ]);
    static primitives = new Map<string, PrimitiveTypeInformation>([
        ["void", { classification: "primitive", name: "void", sizeof: 0 }],
        ["i32", { classification: "primitive", name: "i32", sizeof: 4 }],
        ["i64", { classification: "primitive", name: "i64", sizeof: 8 }],
        ["u32", { classification: "primitive", name: "u32", sizeof: 4 }],
        ["u64", { classification: "primitive", name: "u64", sizeof: 8 }],
        ["f32", { classification: "primitive", name: "f32", sizeof: 4 }],
        ["f64", { classification: "primitive", name: "f64", sizeof: 8 }],
        ["v128", { classification: "primitive", name: "v128", sizeof: 16 }],
        ["i8x16", { classification: "primitive", name: "i8x16", sizeof: 16 }],
        ["u8x16", { classification: "primitive", name: "u8x16", sizeof: 16 }],
        ["i16x8", { classification: "primitive", name: "i16x8", sizeof: 16 }],
        ["u16x8", { classification: "primitive", name: "u16x8", sizeof: 16 }],
        ["i32x4", { classification: "primitive", name: "i32x4", sizeof: 16 }],
        ["u32x4", { classification: "primitive", name: "u32x4", sizeof: 16 }],
        ["f32x4", { classification: "primitive", name: "f32x4", sizeof: 16 }],
        ["i64x2", { classification: "primitive", name: "i64x2", sizeof: 16 }],
        ["u64x2", { classification: "primitive", name: "u64x2", sizeof: 16 }],
        ["f64x2", { classification: "primitive", name: "f64x2", sizeof: 16 }]
    ]);
    static sizeof(type: string) {
        if (!Primitive.primitives.has(type)) throw new Error(`Invalid primitive type ${type}`);
        return Primitive.primitives.get(type)!.sizeof;
    }
    private binaryenType: binaryen.Type;
    private get pointer(): ExpressionInformation {
        if (typeof this.local_index_or_pointer === "number") throw new Error("unreachable");
        return {
            ...this.local_index_or_pointer,
            ref: this.ctx.mod.copyExpression(this.local_index_or_pointer.ref)
        };
    }
    private get local_index(): number {
        if (typeof this.local_index_or_pointer === "number") return this.local_index_or_pointer;
        throw new Error("unreachable");
    }

    public constructor(
        ctx: Context,
        type: InstanceTypeInformation,
        allocation_location: LinearMemoryLocation,
        pointer: ExpressionInformation
    );
    public constructor(
        ctx: Context,
        type: InstanceTypeInformation,
        allocation_location: AllocationLocation.Local,
        local_index: number
    );
    public constructor(
        ctx: Context,
        type: InstanceTypeInformation,
        allocation_location: AllocationLocation.Transient,
        expression: ExpressionInformation
    );
    constructor(
        private ctx: Context,
        public type: InstanceTypeInformation,
        private allocation_location:
            | AllocationLocation.Local
            | AllocationLocation.Transient
            | LinearMemoryLocation,
        // if allocation_location is Local, this is the local index
        // if allocation_location is LinearMemory, this is the pointer (possibly to the start of a parent struct)
        // if allocation_location is Transient, this is the expression
        private local_index_or_pointer: number | ExpressionInformation
    ) {
        if (
            allocation_location === AllocationLocation.Local &&
            typeof local_index_or_pointer !== "number"
        ) {
            throw new Error("Local allocation must have a local index");
        } else if (
            (allocation_location === AllocationLocation.Arena ||
                allocation_location === AllocationLocation.JS) &&
            typeof local_index_or_pointer === "number"
        ) {
            throw new Error("Linear memory allocation must have a pointer");
        } else if (
            allocation_location === AllocationLocation.Transient &&
            typeof local_index_or_pointer === "number"
        ) {
            throw new Error("Transient allocation must have an expression");
        }
        if (!Primitive.primitiveToBinaryen.has(type.name))
            throw new Error(`Invalid primitive type ${type.name}`);

        this.binaryenType = Primitive.primitiveToBinaryen.get(type.name)!;
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(Primitive.sizeof(this.type.name));
    }

    get(): ExpressionInformation {
        if (this.allocation_location === AllocationLocation.Local) {
            return {
                expression: binaryen.ExpressionIds.LocalGet,
                ref: this.ctx.mod.local.get(this.local_index, this.binaryenType),
                type: this.type
            };
        } else if (this.allocation_location === AllocationLocation.Transient) {
            return this.pointer;
        } else {
            let ref;
            if (this.binaryenType === binaryen.i32) {
                ref = this.ctx.mod.i32.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.i64) {
                ref = this.ctx.mod.i64.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.f32) {
                ref = this.ctx.mod.f32.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.f64) {
                ref = this.ctx.mod.f64.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.v128) {
                ref = this.ctx.mod.v128.load(0, 0, this.pointer.ref, "main_memory");
            } else {
                throw new Error("unreachable");
            }
            return {
                expression: binaryen.ExpressionIds.Load,
                ref,
                type: this.type
            };
        }
    }

    set(value: ExpressionInformation): ExpressionInformation {
        if (this.allocation_location === AllocationLocation.Local) {
            return {
                expression: binaryen.ExpressionIds.LocalSet,
                ref: this.ctx.mod.local.tee(this.local_index, value.ref, this.binaryenType),
                type: this.type
            };
        } else if (this.allocation_location === AllocationLocation.Transient) {
            throw new Error("Cannot set transient value");
        } else {
            let ref;
            // replicate tee behavior
            // TODO: ensure binaryen optimizes out the extra load
            if (this.binaryenType === binaryen.i32) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.i32.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.i64) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.i64.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.i64.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.f32) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.f32.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.f32.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.f64) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.f64.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.f64.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.v128) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.v128.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.v128.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else {
                throw new Error("unreachable");
            }
            return {
                expression: binaryen.ExpressionIds.Block,
                ref,
                type: this.type
            };
        }
    }

    access(accessor: string): MiteType {
        throw new Error("Unable to access properties of a primitive.");
    }

    index(index: ExpressionInformation): MiteType {
        throw new Error("Unable to access indices of a primitive.");
    }

    operator(operator: BinaryOperator): BinaryOperatorHandler {
        const bin_op = ((
                operation: (
                    left: binaryen.ExpressionRef,
                    right: binaryen.ExpressionRef
                ) => binaryen.ExpressionRef,
                result?: InstanceTypeInformation
            ) =>
            (left: MiteType, right: MiteType): MiteType => {
                return new Primitive(this.ctx, result ?? left.type, AllocationLocation.Transient, {
                    ref: operation(left.get().ref, right.get().ref),
                    expression: binaryen.ExpressionIds.Binary,
                    type: result ?? left.type
                });
            }).bind(this);

        const mod = this.ctx.mod;

        switch (this.type.name) {
            case "void":
                throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
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
                        return bin_op(mod.f32.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f32.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f32.lt, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f32.le, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f32.gt, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f32.ge, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.f64.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f64.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f64.lt, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f64.le, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f64.gt, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f64.ge, Primitive.primitives.get("i32")!);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
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
                        return bin_op(mod.i32.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32.lt_s, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32.le_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32.gt_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32.ge_s, Primitive.primitives.get("i32")!);
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
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
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
                        return bin_op(mod.i32.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32.lt_u, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32.le_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32.gt_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32.ge_u, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i64.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i64.lt_s, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i64.le_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i64.gt_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i64.ge_s, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i64.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i64.lt_u, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i64.le_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i64.gt_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i64.ge_u, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i8x16.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i8x16.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i8x16.lt_s, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i8x16.le_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i8x16.gt_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i8x16.ge_s, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i8x16.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i8x16.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i8x16.lt_u, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i8x16.le_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i8x16.gt_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i8x16.ge_u, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i16x8.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i16x8.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i16x8.lt_s, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i16x8.le_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i16x8.gt_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i16x8.ge_s, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i16x8.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i16x8.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i16x8.lt_u, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i16x8.le_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i16x8.gt_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i16x8.ge_u, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i32x4.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32x4.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32x4.lt_s, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32x4.le_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32x4.gt_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32x4.ge_s, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i32x4.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i32x4.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i32x4.lt_u, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i32x4.le_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i32x4.gt_u, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i32x4.ge_u, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i64x2.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64x2.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.i64x2.lt_s, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.i64x2.le_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.i64x2.gt_s, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.i64x2.ge_s, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.i64x2.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.i64x2.ne, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.f32x4.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f32x4.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f32x4.lt, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f32x4.le, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f32x4.gt, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f32x4.ge, Primitive.primitives.get("i32")!);
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
                        return bin_op(mod.f64x2.eq, Primitive.primitives.get("i32")!);
                    case TokenType.NOT_EQUALS:
                        return bin_op(mod.f64x2.ne, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN:
                        return bin_op(mod.f64x2.lt, Primitive.primitives.get("i32")!);
                    case TokenType.LESS_THAN_EQUALS:
                        return bin_op(mod.f64x2.le, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN:
                        return bin_op(mod.f64x2.gt, Primitive.primitives.get("i32")!);
                    case TokenType.GREATER_THAN_EQUALS:
                        return bin_op(mod.f64x2.ge, Primitive.primitives.get("i32")!);
                    default:
                        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
                }
            default:
                throw new Error(`Unable to create binary operations for ${this.type.name}`);
        }

        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
    }
}

export class Struct implements MiteType {
    constructor(
        private ctx: Context,
        public type: InstanceStructTypeInformation,
        private address: Primitive
    ) {}

    get(): ExpressionInformation {
        return this.address.get();
    }

    set(value: ExpressionInformation): ExpressionInformation {
        const value_type = value.type as InstanceStructTypeInformation;
        if (value_type.classification !== "struct" || value_type.name !== this.type.name) {
            throw new Error(`Unable to assign ${value_type.name} to ${this.type.name}`);
        }
        if (this.type.immutable) {
            throw new Error(`Unable to assign to immutable array ${this.type.name}`);
        }

        if ((!this.address.type.immutable && value_type.is_ref) || this.type.is_ref) {
            return this.address!.set(value);
        } else {
            const assignment = this.ctx.mod.memory.copy(
                this.get().ref,
                value.ref,
                this.sizeof(),
                "main_memory",
                "main_memory"
            );

            return {
                expression: binaryen.ExpressionIds.MemoryCopy,
                ref: assignment,
                type: Primitive.primitives.get("void")!
            };
        }
    }

    access(accessor: string): MiteType {
        if (!this.type.fields.has(accessor))
            throw new Error(`Struct ${this.type.name} does not have field ${accessor}`);
        const field = this.type.fields.get(accessor)!;
        const type = structuredClone(field.type) as unknown as InstanceTypeInformation;
        type.location = this.type.location;
        type.is_ref = field.is_ref;

        return createMiteType(
            this.ctx,
            type,
            new Primitive(
                this.ctx,
                Primitive.primitives.get("i32")!,
                // @ts-expect-error typescript is dumb
                type.is_ref ? this.type.location : AllocationLocation.Transient,
                {
                    ref: this.ctx.mod.i32.add(this.get().ref, this.ctx.mod.i32.const(field.offset)),
                    expression: binaryen.ExpressionIds.Binary,
                    type
                }
            )
        );
    }

    index(index: ExpressionInformation): MiteType {
        throw new Error("Unable to access indices of a struct.");
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(this.type.sizeof);
    }

    operator(operator: BinaryOperator): BinaryOperatorHandler {
        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
    }
}

export class Array implements MiteType {
    constructor(
        private ctx: Context,
        public type: InstanceArrayTypeInformation,
        private address: Primitive
    ) {}

    get(): ExpressionInformation {
        return this.address.get();
    }

    set(value: ExpressionInformation): ExpressionInformation {
        const value_type = value.type as InstanceStructTypeInformation;
        if (value_type.classification !== "struct" || value_type.name !== this.type.name) {
            throw new Error(`Unable to assign ${value_type.name} to ${this.type.name}`);
        }
        if (this.type.immutable) {
            throw new Error(`Unable to assign to immutable array ${this.type.name}`);
        }

        if ((!this.address.type.immutable && value_type.is_ref) || this.type.is_ref) {
            return this.address!.set(value);
        } else {
            const assignment = this.ctx.mod.memory.copy(
                this.get().ref,
                value.ref,
                this.sizeof(),
                "main_memory",
                "main_memory"
            );

            return {
                expression: binaryen.ExpressionIds.MemoryCopy,
                ref: assignment,
                type: Primitive.primitives.get("void")!
            };
        }
    }

    access(accessor: string): MiteType {
        throw new Error("Unable to access properties of an array.");
    }

    index(index: ExpressionInformation): MiteType {
        if (index.type.name !== "i32")
            throw new Error(`Array index must be an i32, not ${index.type.name}`);

        const addr = {
            ref: this.ctx.mod.i32.add(
                this.get().ref,
                this.ctx.mod.i32.mul(
                    index.ref,
                    this.ctx.mod.i32.const(this.type.element_type.sizeof)
                )
            ),
            expression: binaryen.ExpressionIds.Binary,
            type: this.type.element_type
        };

        return createMiteType(
            this.ctx,
            this.type.element_type,
            new Primitive(
                this.ctx,
                Primitive.primitives.get("i32")!,
                // @ts-expect-error typescript is dumb
                this.type.element_type.is_ref ? this.type.location : AllocationLocation.Transient,
                addr
            )
        );
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(this.type.sizeof);
    }

    operator(operator: BinaryOperator): BinaryOperatorHandler {
        throw new Error(`Invalid operator ${operator} for ${this.type.name}`);
    }
}

// funcref, externref
// export class Reference implements MiteType {}
