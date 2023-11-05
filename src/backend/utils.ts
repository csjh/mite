import binaryen from "binaryen";
import {
    BinaryOperator as BinaryenBinaryOperator,
    Context,
    ExpressionInformation,
    TypeInformation
} from "../types/code_gen.js";
import { Identifier, MemberExpression } from "../types/nodes.js";
import { AllocationLocation, MiteType, Primitive, Struct } from "./type_classes.js";
import { BinaryOperator, TokenType } from "../types/tokens.js";

export const STACK_POINTER = "__stack_pointer";

export function updateExpected(ctx: Context, expected: Context["expected"]) {
    return { ...ctx, expected };
}

export function bigintToLowAndHigh(num: bigint | number): [number, number] {
    if (typeof num === "number") num = BigInt(Math.floor(num));
    num = BigInt.asUintN(64, num);
    return [Number(num & 0xffffffffn), Number(num >> 32n)];
}

export function lookForVariable(ctx: Context, name: string): MiteType {
    const variable = ctx.variables.get(name);
    if (!variable) throw new Error(`Unknown variable: ${name}`);
    return variable;
}

export function getBinaryOperator(
    ctx: Context,
    type: TypeInformation,
    operator: BinaryOperator
): BinaryenBinaryOperator {
    switch (operator) {
        case TokenType.PLUS:
            if (!ctx.operators[type.name].add) throw new Error(`Cannot add ${type.name}`);
            return ctx.operators[type.name].add!;
        case TokenType.MINUS:
            if (!ctx.operators[type.name].sub) throw new Error(`Cannot subtract ${type.name}`);
            return ctx.operators[type.name].sub!;
        case TokenType.STAR:
            if (!ctx.operators[type.name].mul) throw new Error(`Cannot multiply ${type.name}`);
            return ctx.operators[type.name].mul!;
        case TokenType.SLASH:
            if (!ctx.operators[type.name].div) throw new Error(`Cannot divide ${type.name}`);
            return ctx.operators[type.name].div!;
        case TokenType.EQUALS:
            if (!ctx.operators[type.name].div)
                throw new Error(`Cannot check equality of ${type.name}`);
            return ctx.operators[type.name].eq!;
        case TokenType.NOT_EQUALS:
            if (!ctx.operators[type.name].div)
                throw new Error(`Cannot check equality of ${type.name}`);
            return ctx.operators[type.name].ne!;
        case TokenType.LESS_THAN:
            if (!ctx.operators[type.name].div) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].lt!;
        case TokenType.LESS_THAN_EQUALS:
            if (!ctx.operators[type.name].div) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].lte!;
        case TokenType.GREATER_THAN:
            if (!ctx.operators[type.name].div) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].gt!;
        case TokenType.GREATER_THAN_EQUALS:
            if (!ctx.operators[type.name].div) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].gte!;
        case TokenType.BITSHIFT_LEFT:
            if (!ctx.operators[type.name].shl) throw new Error(`Cannot shift ${type.name}`);
            return ctx.operators[type.name].shl!;
        case TokenType.BITSHIFT_RIGHT:
            if (!ctx.operators[type.name].shr) throw new Error(`Cannot shift ${type.name}`);
            return ctx.operators[type.name].shr!;
        case TokenType.MODULUS:
            if (!ctx.operators[type.name].mod) throw new Error(`Cannot mod ${type.name}`);
            return ctx.operators[type.name].mod!;
        case TokenType.BITWISE_OR:
            if (!ctx.operators[type.name].or) throw new Error(`Cannot bitwise or ${type.name}`);
            return ctx.operators[type.name].or!;
        case TokenType.BITWISE_XOR:
            if (!ctx.operators[type.name].xor) throw new Error(`Cannot bitwise xor ${type.name}`);
            return ctx.operators[type.name].xor!;
        case TokenType.BITWISE_AND:
            if (!ctx.operators[type.name].and) throw new Error(`Cannot bitwise and ${type.name}`);
            return ctx.operators[type.name].and!;
    }

    throw new Error(`Unknown operator: ${operator}`);
}

export function createMiteType(
    ctx: Context,
    type_name: string,
    value_or_index: ExpressionInformation | number,
    offset: number
): MiteType {
    const type = ctx.types[type_name];
    if (type.classification === "primitive") {
        const allocation_location =
            typeof value_or_index === "number"
                ? AllocationLocation.Local
                : AllocationLocation.LinearMemory;
        return new Primitive(ctx, type, allocation_location, value_or_index, offset);
    } else if (type.classification === "struct") {
        if (typeof value_or_index === "number") {
            throw new Error("Cannot create struct with index");
        }
        return new Struct(ctx, type, value_or_index, offset);
    } else {
        throw new Error(`Unknown type: ${type}`);
    }
}

// converts a mite type to binaryen type (for parameter or return type)
export function typeInformationToBinaryen(type: TypeInformation) {
    if (type.classification === "primitive") {
        return Primitive.primitiveToBinaryen.get(type.name)!;
    }
    return binaryen.i32;
}

export function miteSignatureToBinaryenSignature(
    ctx: Context,
    name: string,
    variables: TypeInformation[],
    body: binaryen.ExpressionRef
): binaryen.ExpressionRef {
    const { params, results, stack_frame_size } = ctx.current_function;

    const binaryen_parameters = binaryen.createType(params.map(typeInformationToBinaryen));
    const binaryen_return_type = typeInformationToBinaryen(results);
    const binaryen_variables = variables.map(typeInformationToBinaryen);

    const block = ctx.mod.block(null, [
        ctx.mod.global.set(
            STACK_POINTER,
            ctx.mod.i32.sub(
                ctx.mod.global.get(STACK_POINTER, binaryen.i32),
                ctx.mod.i32.const(stack_frame_size)
            )
        ),
        ctx.mod.local.set(params.length, ctx.mod.global.get(STACK_POINTER, binaryen.i32)),
        body,
        ctx.mod.global.set(
            STACK_POINTER,
            ctx.mod.i32.add(
                ctx.mod.global.get(STACK_POINTER, binaryen.i32),
                ctx.mod.i32.const(stack_frame_size)
            )
        )
    ]);

    return ctx.mod.addFunction(
        name,
        binaryen_parameters,
        binaryen_return_type,
        binaryen_variables,
        block
    );
}

export function unwrapPossibleMemberExpression(
    ctx: Context,
    expr: MemberExpression | Identifier
): MiteType {
    if (expr.type === "Identifier") return lookForVariable(ctx, expr.name);
    const value = unwrapPossibleMemberExpression(ctx, expr.object);
    return value.access(expr.property.name);
}
