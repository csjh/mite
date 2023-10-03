export function updateExpected(ctx: Context, expected: Context["expected"]) {
    return { ...ctx, expected };
}

export function bigintToLowAndHigh(num: bigint | number): [number, number] {
    if (typeof num === "number") num = BigInt(Math.floor(num));
    num = BigInt.asUintN(64, num);
    return [Number(num & BigInt(0xffffffff)), Number(num >> BigInt(32))];
}

import binaryen from "binaryen";
import { Context, ExpressionInformation, LocalVariableInformation } from "../types/code_gen.js";
import { TYPES } from "../types/code_gen.js";

type TypeOperations = Record<
    TYPES,
    {
        add: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        sub: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        mul: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        div: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        eq: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        ne: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        lt: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        lte: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        gt: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        gte: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        shl?: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        shr?: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        mod?: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        and?: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        or?: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        xor?: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        coerce: (expr: ExpressionInformation, ctx: Context) => ExpressionInformation;
    }
>;

export function createTypeOperations(mod: binaryen.Module) {
    return {
        [TYPES.f32]: {
            add: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f32.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f32.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f32.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f32.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            coerce: (expr) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return expr;
                    case TYPES.f64:
                        return {
                            type: TYPES.f32,
                            ref: mod.f32.demote(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.i32:
                        return {
                            type: TYPES.f32,
                            ref: expr.isUnsigned
                                ? mod.f32.convert_u.i32(expr.ref)
                                : mod.f32.convert_s.i32(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.i64:
                        return {
                            type: TYPES.f32,
                            ref: expr.isUnsigned
                                ? mod.f32.convert_u.i64(expr.ref)
                                : mod.f32.convert_s.i64(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to f32`);
                }
            }
        },
        [TYPES.f64]: {
            add: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: TYPES.i32,
                ref: mod.f64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            coerce: (expr) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return {
                            type: TYPES.f64,
                            ref: mod.f64.promote(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.f64:
                        return expr;
                    case TYPES.i32:
                        return {
                            type: TYPES.f64,
                            ref: expr.isUnsigned
                                ? mod.f64.convert_u.i32(expr.ref)
                                : mod.f64.convert_s.i32(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.i64:
                        return {
                            type: TYPES.f64,
                            ref: expr.isUnsigned
                                ? mod.f64.convert_u.i64(expr.ref)
                                : mod.f64.convert_s.i64(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to f64`);
                }
            }
        },
        [TYPES.i32]: {
            add: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.div_u(left.ref, right.ref)
                    : mod.i32.div_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.lt_u(left.ref, right.ref)
                    : mod.i32.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.le_u(left.ref, right.ref)
                    : mod.i32.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.gt_u(left.ref, right.ref)
                    : mod.i32.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.ge_u(left.ref, right.ref)
                    : mod.i32.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.shr_u(left.ref, right.ref)
                    : mod.i32.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.rem_u(left.ref, right.ref)
                    : mod.i32.rem_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            coerce: (expr, ctx) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return {
                            type: TYPES.i32,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i32.trunc_u.f32(expr.ref)
                                : mod.i32.trunc_s.f32(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.f64:
                        return {
                            type: TYPES.i32,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i32.trunc_u.f64(expr.ref)
                                : mod.i32.trunc_s.f64(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.i32:
                        return expr;
                    case TYPES.i64:
                        return {
                            type: TYPES.i32,
                            ref: mod.i32.wrap(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to i32`);
                }
            }
        },
        [TYPES.i64]: {
            add: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: TYPES.i64,
                ref: left.isUnsigned
                    ? mod.i64.div_u(left.ref, right.ref)
                    : mod.i64.div_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i64.lt_u(left.ref, right.ref)
                    : mod.i64.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i64.le_u(left.ref, right.ref)
                    : mod.i64.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i64.gt_u(left.ref, right.ref)
                    : mod.i64.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i64.ge_u(left.ref, right.ref)
                    : mod.i64.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: TYPES.i64,
                ref: left.isUnsigned
                    ? mod.i64.shr_u(left.ref, right.ref)
                    : mod.i64.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: TYPES.i64,
                ref: left.isUnsigned
                    ? mod.i64.rem_u(left.ref, right.ref)
                    : mod.i64.rem_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            coerce: (expr, ctx) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return {
                            type: TYPES.i64,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i64.trunc_u.f32(expr.ref)
                                : mod.i64.trunc_s.f32(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.f64:
                        return {
                            type: TYPES.i64,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i64.trunc_u.f64(expr.ref)
                                : mod.i64.trunc_s.f64(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.i32:
                        return {
                            type: TYPES.i64,
                            ref: mod.i64.extend_s(expr.ref),
                            expression: binaryen.ExpressionIds.Unary
                        };
                    case TYPES.i64:
                        return expr;
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to i64`);
                }
            }
        },
        [TYPES.void]: {
            add: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            sub: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            mul: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            div: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            eq: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            ne: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            lt: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            lte: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            gt: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            gte: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            coerce: () => ({
                type: TYPES.void,
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            })
        }
    } as const satisfies TypeOperations;
}

export function lookForVariable(ctx: Context, name: string): LocalVariableInformation {
    const variable = ctx.variables.get(name);
    if (!variable) throw new Error(`Unknown variable: ${name}`);
    return variable;
}

export function coerceBinaryExpression(
    ctx: Context,
    [left, right]: [ExpressionInformation, ExpressionInformation]
): [ExpressionInformation, ExpressionInformation] {
    if (ctx.expected) {
        return [coerceToExpected(ctx, left), coerceToExpected(ctx, right)];
    }

    if (left.type === right.type) return [left, right];
    for (const type of [binaryen.f64, binaryen.f32, binaryen.i64, binaryen.i32]) {
        if (left.type === type) return [left, ctx.type_operations[left.type].coerce(right, ctx)];
        if (right.type === type) return [ctx.type_operations[right.type].coerce(left, ctx), right];
    }

    throw new Error(`Unknown coercion: ${left.type} to ${right.type}`);
}

export function coerceToExpected(ctx: Context, expr: ExpressionInformation): ExpressionInformation {
    if (ctx.expected) {
        return ctx.type_operations[ctx.expected.type].coerce(expr, ctx);
    }
    return expr;
}

// prettier-ignore
const function_operators = new Map([
    ["clz", [[[TYPES.i32], TYPES.i32], [[TYPES.i64], TYPES.i64]]],
    ["ctz", [[[TYPES.i32], TYPES.i32], [[TYPES.i64], TYPES.i64]]],
    ["popcnt", [[[TYPES.i32], TYPES.i32], [[TYPES.i64], TYPES.i64]]],
    ["rotl", [[[TYPES.i32, TYPES.i32], TYPES.i32], [[TYPES.i64, TYPES.i64], TYPES.i64]]],
    ["rotr", [[[TYPES.i32, TYPES.i32], TYPES.i32], [[TYPES.i64, TYPES.i64], TYPES.i64]]],
    ["abs", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["ceil", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["floor", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["trunc", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["nearest", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["sqrt", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["min", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["max", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["copysign", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f64]]],
    ["reinterpret", [[[TYPES.f32], TYPES.i32], [[TYPES.f64], TYPES.i64], [[TYPES.i32], TYPES.f32], [[TYPES.i64], TYPES.f64]]],
    ["i32", [[[TYPES.f32], TYPES.i32], [[TYPES.f64], TYPES.i32], [[TYPES.i32], TYPES.i32], [[TYPES.i64], TYPES.i32]]],
    ["i64", [[[TYPES.f32], TYPES.i64], [[TYPES.f64], TYPES.i64], [[TYPES.i32], TYPES.i64], [[TYPES.i64], TYPES.i64]]],
    ["f32", [[[TYPES.f32], TYPES.f32], [[TYPES.f64], TYPES.f32], [[TYPES.i32], TYPES.f32], [[TYPES.i64], TYPES.f32]]],
    ["f64", [[[TYPES.f32], TYPES.f64], [[TYPES.f64], TYPES.f64], [[TYPES.i32], TYPES.f64], [[TYPES.i64], TYPES.f64]]],
] satisfies [string, [TYPES[], TYPES][]][]);

type FunctionOperators = typeof function_operators extends Map<infer T, unknown> ? T : never;

export function isFunctionOperator(operator: string): operator is FunctionOperators {
    return function_operators.has(operator);
}

export function handleFunctionOperator(
    ctx: Context,
    operator: FunctionOperators,
    args: ExpressionInformation[]
): ExpressionInformation {
    const expected = function_operators.get(operator)!;
    const actual = args.map((arg) => arg.type);
    const index = expected.findIndex((types) => types[0].every((type, i) => type === actual[i]));
    if (index === -1)
        throw new Error(
            `Unknown function operator: ${operator}(${actual
                .map((type) => TYPES[type])
                .join(", ")})`
        );

    const namespace = expected[index][1];

    if (["i32", "i64", "f32", "f64"].includes(operator)) {
        return ctx.type_operations[namespace].coerce(args[0], ctx);
    }

    // @ts-expect-error ooooo typescript big mad!!!
    if (!ctx.mod[TYPES[namespace]][operator])
        throw new Error(`Unknown function operator: ${operator}(${actual.join(", ")})`);

    return {
        type: namespace,
        // @ts-expect-error >:(
        ref: ctx.mod[TYPES[namespace]][operator](...args.map((arg) => arg.ref)),
        expression: expected.length === 1 ? binaryen.ExpressionIds.Unary : binaryen.ExpressionIds.Binary
    };
}
