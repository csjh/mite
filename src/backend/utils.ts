export function bigintToLowAndHigh(num: bigint | number): [number, number] {
    if (typeof num === "number") num = BigInt(Math.floor(num));
    num = BigInt.asUintN(64, num);
    return [Number(num & BigInt(0xffffffff)), Number(num >> BigInt(32))];
}

import binaryen from "binaryen";
import { Context, ExpressionInformation } from "../types/code_gen.js";

// todo: arbitrary
type ValidTypes = import("../types/code_gen.js").LocalVariableInformation["type"];

export function createTypeOperations(mod: binaryen.Module): Record<
    ValidTypes,
    {
        add: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        sub: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        mul: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        div: (left: ExpressionInformation, right: ExpressionInformation) => ExpressionInformation;
        coerce: (expr: ExpressionInformation, ctx: Context) => ExpressionInformation;
    }
> {
    return {
        f32: {
            add: (left, right) => ({
                type: "f32",
                binaryenType: binaryen.f32,
                ref: mod.f32.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: "f32",
                binaryenType: binaryen.f32,
                ref: mod.f32.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: "f32",
                binaryenType: binaryen.f32,
                ref: mod.f32.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: "f32",
                binaryenType: binaryen.f32,
                ref: mod.f32.div(left.ref, right.ref)
            }),
            coerce: (expr) => {
                switch (expr.type) {
                    case "f32":
                        return expr;
                    case "f64":
                        return {
                            type: "f32",
                            binaryenType: binaryen.f32,
                            ref: mod.f32.demote(expr.ref)
                        };
                    case "i32":
                        return {
                            type: "f32",
                            binaryenType: binaryen.f32,
                            ref: expr.isUnsigned
                                ? mod.f32.convert_u.i32(expr.ref)
                                : mod.f32.convert_s.i32(expr.ref)
                        };
                    case "i64":
                        return {
                            type: "f32",
                            binaryenType: binaryen.f32,
                            ref: expr.isUnsigned
                                ? mod.f32.convert_u.i64(expr.ref)
                                : mod.f32.convert_s.i64(expr.ref)
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to f32`);
                }
            }
        },
        f64: {
            add: (left, right) => ({
                type: "f64",
                binaryenType: binaryen.f64,
                ref: mod.f64.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: "f64",
                binaryenType: binaryen.f64,
                ref: mod.f64.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: "f64",
                binaryenType: binaryen.f64,
                ref: mod.f64.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: "f64",
                binaryenType: binaryen.f64,
                ref: mod.f64.div(left.ref, right.ref)
            }),
            coerce: (expr) => {
                switch (expr.type) {
                    case "f32":
                        return {
                            type: "f64",
                            binaryenType: binaryen.f64,
                            ref: mod.f64.promote(expr.ref)
                        };
                    case "f64":
                        return expr;
                    case "i32":
                        return {
                            type: "f64",
                            binaryenType: binaryen.f64,
                            ref: expr.isUnsigned
                                ? mod.f64.convert_u.i32(expr.ref)
                                : mod.f64.convert_s.i32(expr.ref)
                        };
                    case "i64":
                        return {
                            type: "f64",
                            binaryenType: binaryen.f64,
                            ref: expr.isUnsigned
                                ? mod.f64.convert_u.i64(expr.ref)
                                : mod.f64.convert_s.i64(expr.ref)
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to f64`);
                }
            }
        },
        i32: {
            add: (left, right) => ({
                type: "i32",
                binaryenType: binaryen.i32,
                ref: mod.i32.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: "i32",
                binaryenType: binaryen.i32,
                ref: mod.i32.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: "i32",
                binaryenType: binaryen.i32,
                ref: mod.i32.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: "i32",
                binaryenType: binaryen.i32,
                ref: left.isUnsigned
                    ? mod.i32.div_u(left.ref, right.ref)
                    : mod.i32.div_s(left.ref, right.ref)
            }),
            coerce: (expr, ctx) => {
                switch (expr.type) {
                    case "f32":
                        return {
                            type: "i32",
                            binaryenType: binaryen.i32,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i32.trunc_u.f32(expr.ref)
                                : mod.i32.trunc_s.f32(expr.ref)
                        };
                    case "f64":
                        return {
                            type: "i32",
                            binaryenType: binaryen.i32,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i32.trunc_u.f64(expr.ref)
                                : mod.i32.trunc_s.f64(expr.ref)
                        };
                    case "i32":
                        return expr;
                    case "i64":
                        return {
                            type: "i32",
                            binaryenType: binaryen.i32,
                            ref: mod.i32.wrap(expr.ref)
                        };
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to i32`);
                }
            }
        },
        i64: {
            add: (left, right) => ({
                type: "i64",
                binaryenType: binaryen.i64,
                ref: mod.i64.add(left.ref, right.ref)
            }),
            sub: (left, right) => ({
                type: "i64",
                binaryenType: binaryen.i64,
                ref: mod.i64.sub(left.ref, right.ref)
            }),
            mul: (left, right) => ({
                type: "i64",
                binaryenType: binaryen.i64,
                ref: mod.i64.mul(left.ref, right.ref)
            }),
            div: (left, right) => ({
                type: "i64",
                binaryenType: binaryen.i64,
                ref: left.isUnsigned
                    ? mod.i64.div_u(left.ref, right.ref)
                    : mod.i64.div_s(left.ref, right.ref)
            }),
            coerce: (expr, ctx) => {
                switch (expr.type) {
                    case "f32":
                        return {
                            type: "i64",
                            binaryenType: binaryen.i64,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i64.trunc_u.f32(expr.ref)
                                : mod.i64.trunc_s.f32(expr.ref)
                        };
                    case "f64":
                        return {
                            type: "i64",
                            binaryenType: binaryen.i64,
                            ref: ctx.expected?.isUnsigned
                                ? mod.i64.trunc_u.f64(expr.ref)
                                : mod.i64.trunc_s.f64(expr.ref)
                        };
                    case "i32":
                        return {
                            type: "i64",
                            binaryenType: binaryen.i64,
                            ref: mod.i64.extend_s(expr.ref)
                        };
                    case "i64":
                        return expr;
                    default:
                        throw new Error(`Cannot coerce ${expr.type} to i64`);
                }
            }
        },
        void: {
            add: () => {
                return {
                    type: "void",
                    binaryenType: binaryen.none,
                    ref: mod.nop()
                };
            },
            sub: () => {
                return {
                    type: "void",
                    binaryenType: binaryen.none,
                    ref: mod.nop()
                };
            },
            mul: () => {
                return {
                    type: "void",
                    binaryenType: binaryen.none,
                    ref: mod.nop()
                };
            },
            div: () => {
                return {
                    type: "void",
                    binaryenType: binaryen.none,
                    ref: mod.nop()
                };
            },
            coerce: () => {
                return {
                    type: "void",
                    binaryenType: binaryen.none,
                    ref: mod.nop()
                };
            }
        }
    };
}
