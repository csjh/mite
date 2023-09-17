export function bigintToLowAndHigh(num: bigint | number): [number, number] {
    if (typeof num === "number") num = BigInt(Math.floor(num));
    num = BigInt.asUintN(64, num);
    return [Number(num & BigInt(0xffffffff)), Number(num >> BigInt(32))];
}

import binaryen from "binaryen";
import { Context, ExpressionInformation, LocalVariableInformation } from "../types/code_gen.js";
import { BinaryExpression } from "../types/nodes.js";
import { TYPES } from "../types/code_gen.js";

// todo: arbitrary
type ValidTypes = LocalVariableInformation["type"];

export function createTypeOperations(mod: binaryen.Module): Record<
    ValidTypes,
    {
        add: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        sub: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        mul: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        div: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        lt: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        coerce: (expr: ExpressionInformation, ctx: Context) => ExpressionInformation;
    }
> {
    return {
        [TYPES.f32]: {
            add: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.div(left.ref, right.ref)
            }),
            lt: (left, right) => ({
                type: TYPES.f32,
                ref: mod.f32.lt(left.ref, right.ref)
            }),
            coerce: (expr) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return expr;
                    case TYPES.f64:
                        return {
                            type: TYPES.f32,
                            ref: mod.f32.demote(expr.ref)
                        };
                    case TYPES.i32:
                        return {
                            type: TYPES.f32,
                            ref: expr.isUnsigned
                                ? mod.f32.convert_u.i32(expr.ref)
                                : mod.f32.convert_s.i32(expr.ref)
                        };
                    case TYPES.i64:
                        return {
                            type: TYPES.f32,
                            ref: expr.isUnsigned
                                ? mod.f32.convert_u.i64(expr.ref)
                                : mod.f32.convert_s.i64(expr.ref)
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to f32`);
                }
            }
        },
        [TYPES.f64]: {
            add: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.div(left.ref, right.ref)
            }),
            lt: (left, right) => ({
                type: TYPES.f64,
                ref: mod.f64.lt(left.ref, right.ref)
            }),
            coerce: (expr) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return {
                            type: TYPES.f64,
                            ref: mod.f64.promote(expr.ref)
                        };
                    case TYPES.f64:
                        return expr;
                    case TYPES.i32:
                        return {
                            type: TYPES.f64,
                            ref: expr.isUnsigned
                                ? mod.f64.convert_u.i32(expr.ref)
                                : mod.f64.convert_s.i32(expr.ref)
                        };
                    case TYPES.i64:
                        return {
                            type: TYPES.f64,
                            ref: expr.isUnsigned
                                ? mod.f64.convert_u.i64(expr.ref)
                                : mod.f64.convert_s.i64(expr.ref)
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to f64`);
                }
            }
        },
        [TYPES.i32]: {
            add: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: TYPES.i32,
                ref: mod.i32.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.div_u(left.ref, right.ref)
                    : mod.i32.div_s(left.ref, right.ref)
            }),
            lt: (left, right) => ({
                type: TYPES.i32,
                ref: left.isUnsigned
                    ? mod.i32.lt_u(left.ref, right.ref)
                    : mod.i32.lt_s(left.ref, right.ref)
            }),
            coerce: (expr, ctx) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return {
                            type: TYPES.i32,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i32.trunc_u.f32(expr.ref)
                                : mod.i32.trunc_s.f32(expr.ref)
                        };
                    case TYPES.f64:
                        return {
                            type: TYPES.i32,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i32.trunc_u.f64(expr.ref)
                                : mod.i32.trunc_s.f64(expr.ref)
                        };
                    case TYPES.i32:
                        return expr;
                    case TYPES.i64:
                        return {
                            type: TYPES.i32,
                            ref: mod.i32.wrap(expr.ref)
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to i32`);
                }
            }
        },
        [TYPES.i64]: {
            add: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: TYPES.i64,
                ref: mod.i64.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: TYPES.i64,
                ref: left.isUnsigned
                    ? mod.i64.div_u(left.ref, right.ref)
                    : mod.i64.div_s(left.ref, right.ref)
            }),
            lt: (left, right) => ({
                type: TYPES.i64,
                ref: left.isUnsigned
                    ? mod.i64.lt_u(left.ref, right.ref)
                    : mod.i64.lt_s(left.ref, right.ref)
            }),
            coerce: (expr, ctx) => {
                switch (expr.type) {
                    case TYPES.f32:
                        return {
                            type: TYPES.i64,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i64.trunc_u.f32(expr.ref)
                                : mod.i64.trunc_s.f32(expr.ref)
                        };
                    case TYPES.f64:
                        return {
                            type: TYPES.i64,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i64.trunc_u.f64(expr.ref)
                                : mod.i64.trunc_s.f64(expr.ref)
                        };
                    case TYPES.i32:
                        return {
                            type: TYPES.i64,
                            ref: mod.i64.extend_s(expr.ref)
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
                ref: mod.nop()
            }),
            sub: () => ({
                type: TYPES.void,
                ref: mod.nop()
            }),
            mul: () => ({
                type: TYPES.void,
                ref: mod.nop()
            }),
            div: () => ({
                type: TYPES.void,
                ref: mod.nop()
            }),
            lt: () => ({
                type: TYPES.void,
                ref: mod.nop()
            }),
            coerce: () => ({
                type: TYPES.void,
                ref: mod.nop()
            })
        }
    };
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
