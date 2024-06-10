// don't be offput by the fact this is 3000 lines, it's almost all boilerplate

import {
    Context,
    FunctionTypeInformation,
    InstanceFunctionTypeInformation,
    InstanceStructTypeInformation,
    PrimitiveTypeInformation,
    StructTypeInformation
} from "../types/code_gen.js";
import {
    ExportNamedDeclaration,
    Program,
    StructDeclaration,
    TypeIdentifier
} from "../types/nodes.js";
import { MiteType, Pointer, Primitive, String_, TransientPrimitive } from "./type_classes.js";
import binaryen from "binaryen";
import { i64const, parseType } from "./utils.js";

export function createConversions(ctx: Context): Context["conversions"] {
    const unary_op =
        (
            operation: (expr: binaryen.ExpressionRef) => binaryen.ExpressionRef,
            result?: PrimitiveTypeInformation
        ) =>
        (expr: MiteType): MiteType => {
            return new TransientPrimitive(
                ctx,
                result ?? (expr as Primitive).type,
                operation(expr.get_expression_ref())
            );
        };

    const wrap_op = (from: "i32" | "i64", to: string) => {
        const to_bits = to === "bool" ? 1 : parseInt(to.slice(1));
        if (from === "i32") {
            return unary_op(
                (expr) => ctx.mod.i32.and(expr, ctx.mod.i32.const(2 ** to_bits - 1)),
                Primitive.primitives.get(to)!
            );
        } else {
            return unary_op(
                (expr) => ctx.mod.i64.and(expr, i64const(ctx, 2 ** to_bits - 1)),
                Primitive.primitives.get(to)!
            );
        }
    };

    // convert from type1 to type2 is obj[type1][type2]
    return {
        bool: {
            bool: (x) => x,
            i8: unary_op((x) => x, ctx.types.i8),
            u8: unary_op((x) => x, ctx.types.u8),
            i16: unary_op((x) => x, ctx.types.i16),
            u16: unary_op((x) => x, ctx.types.u16),
            i32: unary_op((x) => x, ctx.types.i32),
            u32: unary_op((x) => x, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.extend_u, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_u.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_u.i32, ctx.types.f64)
        },
        i8: {
            bool: unary_op((x) => ctx.mod.i32.ne(x, ctx.mod.i32.const(0)), ctx.types.bool),
            i8: (value) => value,
            u8: wrap_op("i32", "u8"),
            i16: unary_op(ctx.mod.i32.extend8_s, ctx.types.i16),
            u16: unary_op((x) => x, ctx.types.u16),
            i32: unary_op(ctx.mod.i32.extend8_s, ctx.types.i32),
            u32: unary_op((x) => x, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.extend8_s, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_s.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_s.i32, ctx.types.f64),
            i8x16: unary_op(ctx.mod.i8x16.splat, ctx.types.i8x16)
        },
        u8: {
            bool: unary_op((x) => ctx.mod.i32.ne(x, ctx.mod.i32.const(0)), ctx.types.bool),
            i8: wrap_op("i32", "i8"),
            u8: (value) => value,
            i16: unary_op((x) => x, ctx.types.i16),
            u16: unary_op((x) => x, ctx.types.u16),
            i32: unary_op((x) => x, ctx.types.i32),
            u32: unary_op((x) => x, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.extend_s, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_u.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_u.i32, ctx.types.f64),
            u8x16: unary_op(ctx.mod.i8x16.splat, ctx.types.u8x16)
        },
        i16: {
            bool: unary_op((x) => ctx.mod.i32.ne(x, ctx.mod.i32.const(0)), ctx.types.bool),
            i8: wrap_op("i32", "i8"),
            u8: wrap_op("i32", "u8"),
            i16: (value) => value,
            u16: unary_op((x) => x, ctx.types.u16),
            i32: unary_op(ctx.mod.i32.extend16_s, ctx.types.i32),
            u32: unary_op((x) => x, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.extend16_s, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_s.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_s.i32, ctx.types.f64),
            i16x8: unary_op(ctx.mod.i16x8.splat, ctx.types.i16x8)
        },
        u16: {
            bool: unary_op((x) => ctx.mod.i32.ne(x, ctx.mod.i32.const(0)), ctx.types.bool),
            i8: wrap_op("i32", "i8"),
            u8: wrap_op("i32", "u8"),
            i16: unary_op((x) => x, ctx.types.i16),
            u16: (value) => value,
            i32: unary_op((x) => x, ctx.types.i32),
            u32: unary_op((x) => x, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.extend_s, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_u.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_u.i32, ctx.types.f64),
            u16x8: unary_op(ctx.mod.i16x8.splat, ctx.types.u16x8)
        },
        i32: {
            bool: unary_op((x) => ctx.mod.i32.ne(x, ctx.mod.i32.const(0)), ctx.types.bool),
            i8: wrap_op("i32", "i8"),
            u8: wrap_op("i32", "u8"),
            i16: wrap_op("i32", "i16"),
            u16: wrap_op("i32", "u16"),
            i32: (value) => value,
            u32: (value) => new TransientPrimitive(ctx, ctx.types.u32, value.get_expression_ref()),
            // TODO: make sure extend_s is proper, should be though
            i64: unary_op(ctx.mod.i64.extend_s, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_s.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_s.i32, ctx.types.f64),
            i32x4: unary_op(ctx.mod.i32x4.splat, ctx.types.i32x4),
            // TODO: remove these when i8, i16 are implemented
            i16x8: unary_op(ctx.mod.i16x8.splat, ctx.types.i16x8),
            i8x16: unary_op(ctx.mod.i8x16.splat, ctx.types.i8x16)
        },
        u32: {
            bool: unary_op((x) => ctx.mod.i32.ne(x, ctx.mod.i32.const(0)), ctx.types.bool),
            i8: wrap_op("i32", "i8"),
            u8: wrap_op("i32", "u8"),
            i16: wrap_op("i32", "i16"),
            u16: wrap_op("i32", "u16"),
            i32: (value) => new TransientPrimitive(ctx, ctx.types.i32, value.get_expression_ref()),
            u32: (value) => value,
            i64: unary_op(ctx.mod.i64.extend_s, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.extend_u, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.convert_u.i32, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_u.i32, ctx.types.f64),
            u32x4: unary_op(ctx.mod.i32x4.splat, ctx.types.u32x4),
            // TODO: remove these when u8, u16 are implemented
            u16x8: unary_op(ctx.mod.i16x8.splat, ctx.types.u16x8),
            u8x16: unary_op(ctx.mod.i8x16.splat, ctx.types.u8x16)
        },
        i64: {
            bool: unary_op((x) => ctx.mod.i64.ne(x, ctx.mod.i64.const(0, 0)), ctx.types.bool),
            i8: wrap_op("i64", "i8"),
            u8: wrap_op("i64", "u8"),
            i16: wrap_op("i64", "i16"),
            u16: wrap_op("i64", "u16"),
            i32: unary_op(ctx.mod.i32.wrap, ctx.types.i32),
            u32: unary_op(ctx.mod.i32.wrap, ctx.types.u32),
            i64: (value) => value,
            u64: (value) => new TransientPrimitive(ctx, ctx.types.u64, value.get_expression_ref()),
            f32: unary_op(ctx.mod.f32.convert_s.i64, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_s.i64, ctx.types.f64),
            i64x2: unary_op(ctx.mod.i64x2.splat, ctx.types.i64x2)
        },
        u64: {
            bool: unary_op((x) => ctx.mod.i64.ne(x, ctx.mod.i64.const(0, 0)), ctx.types.bool),
            i8: wrap_op("i64", "i8"),
            u8: wrap_op("i64", "u8"),
            i16: wrap_op("i64", "i16"),
            u16: wrap_op("i64", "u16"),
            i32: unary_op(ctx.mod.i32.wrap, ctx.types.i32),
            u32: unary_op(ctx.mod.i32.wrap, ctx.types.u32),
            i64: (value) => new TransientPrimitive(ctx, ctx.types.i64, value.get_expression_ref()),
            u64: (value) => value,
            f32: unary_op(ctx.mod.f32.convert_u.i64, ctx.types.f32),
            f64: unary_op(ctx.mod.f64.convert_u.i64, ctx.types.f64),
            u64x2: unary_op(ctx.mod.i64x2.splat, ctx.types.u64x2)
        },
        f32: {
            bool: unary_op((x) => ctx.mod.f32.ne(x, ctx.mod.f32.const(0)), ctx.types.bool),
            i8: (x) => wrap_op("i32", "i8")(unary_op(ctx.mod.i32.trunc_s_sat.f32, ctx.types.i8)(x)),
            u8: (x) => wrap_op("i32", "u8")(unary_op(ctx.mod.i32.trunc_u_sat.f32, ctx.types.u8)(x)),
            i16: (x) =>
                wrap_op("i32", "i16")(unary_op(ctx.mod.i32.trunc_s_sat.f32, ctx.types.i16)(x)),
            u16: (x) =>
                wrap_op("i32", "u16")(unary_op(ctx.mod.i32.trunc_u_sat.f32, ctx.types.u16)(x)),
            i32: unary_op(ctx.mod.i32.trunc_s_sat.f32, ctx.types.i32),
            u32: unary_op(ctx.mod.i32.trunc_u_sat.f32, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.trunc_s_sat.f32, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.trunc_u_sat.f32, ctx.types.u64),
            f32: (value) => value,
            f64: unary_op(ctx.mod.f64.promote, ctx.types.f64),
            f32x4: unary_op(ctx.mod.f32x4.splat, ctx.types.f32x4)
        },
        f64: {
            bool: unary_op((x) => ctx.mod.f64.ne(x, ctx.mod.f64.const(0)), ctx.types.bool),
            i8: (x) => wrap_op("i32", "i8")(unary_op(ctx.mod.i32.trunc_s_sat.f64, ctx.types.i8)(x)),
            u8: (x) => wrap_op("i32", "u8")(unary_op(ctx.mod.i32.trunc_u_sat.f64, ctx.types.u8)(x)),
            i16: (x) =>
                wrap_op("i32", "i16")(unary_op(ctx.mod.i32.trunc_s_sat.f64, ctx.types.i16)(x)),
            u16: (x) =>
                wrap_op("i32", "u16")(unary_op(ctx.mod.i32.trunc_u_sat.f64, ctx.types.u16)(x)),
            i32: unary_op(ctx.mod.i32.trunc_s_sat.f64, ctx.types.i32),
            u32: unary_op(ctx.mod.i32.trunc_u_sat.f64, ctx.types.u32),
            i64: unary_op(ctx.mod.i64.trunc_s_sat.f64, ctx.types.i64),
            u64: unary_op(ctx.mod.i64.trunc_u_sat.f64, ctx.types.u64),
            f32: unary_op(ctx.mod.f32.demote, ctx.types.f32),
            f64: (value) => value,
            f64x2: unary_op(ctx.mod.f64x2.splat, ctx.types.f64x2)
        },
        v128: {
            v128: (value) => value,
            i8x16: (value) =>
                new TransientPrimitive(ctx, ctx.types.i8x16, value.get_expression_ref()),
            u8x16: (value) =>
                new TransientPrimitive(ctx, ctx.types.u8x16, value.get_expression_ref()),
            i16x8: (value) =>
                new TransientPrimitive(ctx, ctx.types.i16x8, value.get_expression_ref()),
            u16x8: (value) =>
                new TransientPrimitive(ctx, ctx.types.u16x8, value.get_expression_ref()),
            i32x4: (value) =>
                new TransientPrimitive(ctx, ctx.types.i32x4, value.get_expression_ref()),
            u32x4: (value) =>
                new TransientPrimitive(ctx, ctx.types.u32x4, value.get_expression_ref()),
            i64x2: (value) =>
                new TransientPrimitive(ctx, ctx.types.i64x2, value.get_expression_ref()),
            u64x2: (value) =>
                new TransientPrimitive(ctx, ctx.types.u64x2, value.get_expression_ref()),
            f32x4: (value) =>
                new TransientPrimitive(ctx, ctx.types.f32x4, value.get_expression_ref()),
            f64x2: (value) =>
                new TransientPrimitive(ctx, ctx.types.f64x2, value.get_expression_ref())
        },
        i8x16: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i8x16: (value) => value,
            u8x16: (value) =>
                new TransientPrimitive(ctx, ctx.types.u8x16, value.get_expression_ref())
        },
        u8x16: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i8x16: (value) =>
                new TransientPrimitive(ctx, ctx.types.i8x16, value.get_expression_ref()),
            u8x16: (value) => value
        },
        i16x8: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i16x8: (value) => value,
            u16x8: (value) =>
                new TransientPrimitive(ctx, ctx.types.u16x8, value.get_expression_ref())
        },
        u16x8: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i16x8: (value) =>
                new TransientPrimitive(ctx, ctx.types.i16x8, value.get_expression_ref()),
            u16x8: (value) => value
        },
        i32x4: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i32x4: (value) => value,
            u32x4: (value) =>
                new TransientPrimitive(ctx, ctx.types.u32x4, value.get_expression_ref()),
            f32x4: unary_op(ctx.mod.f32x4.convert_i32x4_s, ctx.types.f32x4)
        },
        u32x4: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i32x4: (value) =>
                new TransientPrimitive(ctx, ctx.types.i32x4, value.get_expression_ref()),
            u32x4: (value) => value,
            f32x4: unary_op(ctx.mod.f32x4.convert_i32x4_u, ctx.types.f32x4)
        },
        f32x4: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i32x4: unary_op(ctx.mod.i32x4.trunc_sat_f32x4_s, ctx.types.i32x4),
            u32x4: unary_op(ctx.mod.i32x4.trunc_sat_f32x4_u, ctx.types.i32x4),
            f32x4: (value) => value
        },
        i64x2: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i64x2: (value) => value,
            u64x2: (value) =>
                new TransientPrimitive(ctx, ctx.types.u64x2, value.get_expression_ref())
        },
        u64x2: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            i64x2: (value) =>
                new TransientPrimitive(ctx, ctx.types.i64x2, value.get_expression_ref()),
            u64x2: (value) => value
        },
        f64x2: {
            v128: (value) =>
                new TransientPrimitive(ctx, ctx.types.v128, value.get_expression_ref()),
            f64x2: (value) => value
        }
    };
}

export function createIntrinsics(ctx: Context): Context["intrinsics"] {
    const unary_op =
        (
            operation: (expr: binaryen.ExpressionRef) => binaryen.ExpressionRef,
            result?: PrimitiveTypeInformation
        ) =>
        (expr: MiteType): MiteType => {
            return new TransientPrimitive(
                ctx,
                result ?? (expr as Primitive).type,
                operation(expr.get_expression_ref())
            );
        };
    const bin_op =
        (
            operation: (
                left: binaryen.ExpressionRef,
                right: binaryen.ExpressionRef
            ) => binaryen.ExpressionRef,
            result?: PrimitiveTypeInformation
        ) =>
        (left: MiteType, right: MiteType): MiteType => {
            return new TransientPrimitive(
                ctx,
                result ?? (left as Primitive).type,
                operation(left.get_expression_ref(), right.get_expression_ref())
            );
        };
    const ternary_op =
        (
            operation: (
                first: binaryen.ExpressionRef,
                second: binaryen.ExpressionRef,
                third: binaryen.ExpressionRef
            ) => binaryen.ExpressionRef,
            result?: PrimitiveTypeInformation
        ) =>
        (first: MiteType, second: MiteType, third: MiteType): MiteType => {
            return new TransientPrimitive(
                ctx,
                result ?? (first as Primitive).type,
                operation(
                    first.get_expression_ref(),
                    second.get_expression_ref(),
                    third.get_expression_ref()
                )
            );
        };
    const extract_op = (
        operation: (expr: binaryen.ExpressionRef, idx: number) => binaryen.ExpressionRef,
        result: PrimitiveTypeInformation
    ) => {
        return (value: MiteType, index: MiteType) => {
            if (
                binaryen.getExpressionId(index.get_expression_ref()) !==
                binaryen.ExpressionIds.Const
            )
                throw new Error("Expected constant extraction index");

            const binaryen_type = binaryen.getExpressionType(index.get_expression_ref());
            const idx =
                binaryen_type === binaryen.i64
                    ? // @ts-expect-error undocumented function
                      binaryen._BinaryenConstGetValueI64(index.get_expression_ref())
                    : binaryen_type === binaryen.i32
                      ? // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.get_expression_ref())
                      : binaryen_type === binaryen.f32
                        ? // @ts-expect-error undocumented function
                          binaryen._BinaryenConstGetValueF32(index.get_expression_ref())
                        : binaryen_type === binaryen.f64
                          ? // @ts-expect-error undocumented function
                            binaryen._BinaryenConstGetValueF64(index.get_expression_ref())
                          : -1;

            return new TransientPrimitive(ctx, result, operation(value.get_expression_ref(), idx));
        };
    };
    const replace_op = (
        operation: (
            value: binaryen.ExpressionRef,
            index: number,
            replacement: binaryen.ExpressionRef
        ) => binaryen.ExpressionRef,
        result: PrimitiveTypeInformation
    ) => {
        return (value: MiteType, index: MiteType, replacement: MiteType) => {
            if (
                binaryen.getExpressionId(index.get_expression_ref()) !==
                binaryen.ExpressionIds.Const
            )
                throw new Error("Expected constant extraction index");

            const binaryen_type = binaryen.getExpressionType(index.get_expression_ref());
            const idx =
                binaryen_type === binaryen.i64
                    ? // @ts-expect-error undocumented function
                      binaryen._BinaryenConstGetValueI64(index.get_expression_ref())
                    : binaryen_type === binaryen.i32
                      ? // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.get_expression_ref())
                      : binaryen_type === binaryen.f32
                        ? // @ts-expect-error undocumented function
                          binaryen._BinaryenConstGetValueF32(index.get_expression_ref())
                        : binaryen_type === binaryen.f64
                          ? // @ts-expect-error undocumented function
                            binaryen._BinaryenConstGetValueF64(index.get_expression_ref())
                          : -1;

            return new TransientPrimitive(
                ctx,
                result,
                operation(value.get_expression_ref(), idx, replacement.get_expression_ref())
            );
        };
    };

    return {
        void: {},
        f32: {
            sqrt: unary_op(ctx.mod.f32.sqrt),
            ceil: unary_op(ctx.mod.f32.ceil),
            floor: unary_op(ctx.mod.f32.floor),
            trunc: unary_op(ctx.mod.f32.trunc),
            nearest: unary_op(ctx.mod.f32.nearest),
            abs: unary_op(ctx.mod.f32.abs),
            copysign: bin_op(ctx.mod.f32.copysign),
            min: bin_op(ctx.mod.f32.min),
            max: bin_op(ctx.mod.f32.max),
            reinterpret: unary_op(ctx.mod.i32.reinterpret, ctx.types.i32)
        },
        f64: {
            sqrt: unary_op(ctx.mod.f64.sqrt),
            ceil: unary_op(ctx.mod.f64.ceil),
            floor: unary_op(ctx.mod.f64.floor),
            trunc: unary_op(ctx.mod.f64.trunc),
            nearest: unary_op(ctx.mod.f64.nearest),
            abs: unary_op(ctx.mod.f64.abs),
            copysign: bin_op(ctx.mod.f64.copysign),
            min: bin_op(ctx.mod.f64.min),
            max: bin_op(ctx.mod.f64.max),
            reinterpret: unary_op(ctx.mod.i64.reinterpret, ctx.types.i64)
        },
        i32: {
            clz: unary_op(ctx.mod.i32.clz),
            ctz: unary_op(ctx.mod.i32.ctz),
            popcnt: unary_op(ctx.mod.i32.popcnt),
            rotl: bin_op(ctx.mod.i32.rotl),
            rotr: bin_op(ctx.mod.i32.rotr),
            reinterpret: unary_op(ctx.mod.f32.reinterpret, ctx.types.f32)
        },
        u32: {
            clz: unary_op(ctx.mod.i32.clz),
            ctz: unary_op(ctx.mod.i32.ctz),
            popcnt: unary_op(ctx.mod.i32.popcnt),
            rotl: bin_op(ctx.mod.i32.rotl),
            rotr: bin_op(ctx.mod.i32.rotr),
            reinterpret: unary_op(ctx.mod.f32.reinterpret, ctx.types.f32)
        },
        i64: {
            clz: unary_op(ctx.mod.i64.clz),
            ctz: unary_op(ctx.mod.i64.ctz),
            popcnt: unary_op(ctx.mod.i64.popcnt),
            rotl: bin_op(ctx.mod.i64.rotl),
            rotr: bin_op(ctx.mod.i64.rotr),
            reinterpret: unary_op(ctx.mod.f64.reinterpret, ctx.types.f64)
        },
        u64: {
            clz: unary_op(ctx.mod.i64.clz),
            ctz: unary_op(ctx.mod.i64.ctz),
            popcnt: unary_op(ctx.mod.i64.popcnt),
            rotl: bin_op(ctx.mod.i64.rotl),
            rotr: bin_op(ctx.mod.i64.rotr),
            reinterpret: unary_op(ctx.mod.f64.reinterpret, ctx.types.f64)
        },
        v128: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32)
        },
        i8x16: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            swizzle: bin_op(ctx.mod.i8x16.swizzle),
            all_true: unary_op(ctx.mod.i8x16.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i8x16.bitmask, ctx.types.i32),
            popcnt: unary_op(ctx.mod.i8x16.popcnt),
            add_sat: bin_op(ctx.mod.i8x16.add_saturate_s),
            sub_sat: bin_op(ctx.mod.i8x16.sub_saturate_s),
            min: bin_op(ctx.mod.i8x16.min_s),
            max: bin_op(ctx.mod.i8x16.max_s),
            dot: bin_op(ctx.mod.i32x4.dot_i16x8_s),
            extmul_low: bin_op(ctx.mod.i16x8.extmul_low_i8x16_s),
            extmul_high: bin_op(ctx.mod.i16x8.extmul_high_i8x16_s),
            extadd_pairwise: unary_op(ctx.mod.i16x8.extadd_pairwise_i8x16_s),
            extend_low: unary_op(ctx.mod.i16x8.extend_low_i8x16_s),
            extend_high: unary_op(ctx.mod.i16x8.extend_high_i8x16_s),
            extract: extract_op(ctx.mod.i8x16.extract_lane_s, ctx.types.i32),
            replace: replace_op(ctx.mod.i8x16.replace_lane, ctx.types.i8x16),
            shuffle(left, right, mask) {
                const info = binaryen.getExpressionInfo(mask.get_expression_ref());
                const mask_values = (info as binaryen.ConstInfo).value;
                if (
                    (mask.type.name !== "i8x16" && mask.type.name !== "u8x16") ||
                    info.id !== binaryen.ExpressionIds.Const ||
                    !Array.isArray(mask_values)
                ) {
                    throw new Error("Expected constant SIMD mask");
                }

                return new TransientPrimitive(
                    ctx,
                    ctx.types.i8x16,
                    ctx.mod.i8x16.shuffle(
                        left.get_expression_ref(),
                        right.get_expression_ref(),
                        mask_values
                    )
                );
            }
        },
        u8x16: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            swizzle: bin_op(ctx.mod.i8x16.swizzle),
            all_true: unary_op(ctx.mod.i8x16.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i8x16.bitmask, ctx.types.i32),
            popcnt: unary_op(ctx.mod.i8x16.popcnt),
            add_sat: bin_op(ctx.mod.i8x16.add_saturate_u),
            sub_sat: bin_op(ctx.mod.i8x16.sub_saturate_u),
            min: bin_op(ctx.mod.i8x16.min_u),
            max: bin_op(ctx.mod.i8x16.max_u),
            avgr: bin_op(ctx.mod.i8x16.avgr_u),
            extmul_low: bin_op(ctx.mod.i16x8.extmul_low_i8x16_u),
            extmul_high: bin_op(ctx.mod.i16x8.extmul_high_i8x16_u),
            extadd_pairwise: unary_op(ctx.mod.i16x8.extadd_pairwise_i8x16_u),
            extend_low: unary_op(ctx.mod.i16x8.extend_low_i8x16_u),
            extend_high: unary_op(ctx.mod.i16x8.extend_high_i8x16_u),
            extract: extract_op(ctx.mod.i8x16.extract_lane_u, ctx.types.u8),
            replace: replace_op(ctx.mod.i8x16.replace_lane, ctx.types.u8x16)
        },
        i16x8: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            all_true: unary_op(ctx.mod.i16x8.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i16x8.bitmask, ctx.types.i32),
            add_sat: bin_op(ctx.mod.i16x8.add_saturate_s),
            sub_sat: bin_op(ctx.mod.i16x8.sub_saturate_s),
            min: bin_op(ctx.mod.i16x8.min_s),
            max: bin_op(ctx.mod.i16x8.max_s),
            q15mulr: bin_op(ctx.mod.i16x8.q15mulr_sat_s),
            extmul_low: bin_op(ctx.mod.i32x4.extmul_low_i16x8_s),
            extmul_high: bin_op(ctx.mod.i32x4.extmul_high_i16x8_s),
            extadd_pairwise: unary_op(ctx.mod.i32x4.extadd_pairwise_i16x8_s),
            extend_low: unary_op(ctx.mod.i32x4.extend_low_i16x8_s),
            extend_high: unary_op(ctx.mod.i32x4.extend_high_i16x8_s),
            narrow: bin_op(ctx.mod.i8x16.narrow_i16x8_s),
            extract: extract_op(ctx.mod.i16x8.extract_lane_s, ctx.types.i16),
            replace: replace_op(ctx.mod.i16x8.replace_lane, ctx.types.i16x8)
        },
        u16x8: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            all_true: unary_op(ctx.mod.i16x8.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i16x8.bitmask, ctx.types.i32),
            add_sat: bin_op(ctx.mod.i16x8.add_saturate_u),
            sub_sat: bin_op(ctx.mod.i16x8.sub_saturate_u),
            min: bin_op(ctx.mod.i16x8.min_u),
            max: bin_op(ctx.mod.i16x8.max_u),
            avgr: bin_op(ctx.mod.i16x8.avgr_u),
            extmul_low: bin_op(ctx.mod.i32x4.extmul_low_i16x8_u),
            extmul_high: bin_op(ctx.mod.i32x4.extmul_high_i16x8_u),
            extadd_pairwise: unary_op(ctx.mod.i32x4.extadd_pairwise_i16x8_u),
            extend_low: unary_op(ctx.mod.i32x4.extend_low_i16x8_u),
            extend_high: unary_op(ctx.mod.i32x4.extend_high_i16x8_u),
            narrow: bin_op(ctx.mod.i8x16.narrow_i16x8_u),
            extract: extract_op(ctx.mod.i16x8.extract_lane_u, ctx.types.u16),
            replace: replace_op(ctx.mod.i16x8.replace_lane, ctx.types.u16x8)
        },
        i32x4: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            all_true: unary_op(ctx.mod.i32x4.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i32x4.bitmask, ctx.types.i32),
            abs: unary_op(ctx.mod.i32x4.abs),
            min: bin_op(ctx.mod.i32x4.min_s),
            max: bin_op(ctx.mod.i32x4.max_s),
            extmul_low: bin_op(ctx.mod.i64x2.extmul_low_i32x4_s),
            extmul_high: bin_op(ctx.mod.i64x2.extmul_high_i32x4_s),
            extend_high: unary_op(ctx.mod.i64x2.extend_high_i32x4_s),
            extend_low: unary_op(ctx.mod.i64x2.extend_low_i32x4_s),
            narrow: bin_op(ctx.mod.i16x8.narrow_i32x4_s),
            extract: extract_op(ctx.mod.i32x4.extract_lane, ctx.types.i32),
            replace: replace_op(ctx.mod.i32x4.replace_lane, ctx.types.i32x4)
        },
        u32x4: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            all_true: unary_op(ctx.mod.i32x4.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i32x4.bitmask, ctx.types.i32),
            abs: unary_op(ctx.mod.i32x4.abs),
            min: bin_op(ctx.mod.i32x4.min_u),
            max: bin_op(ctx.mod.i32x4.max_u),
            extmul_low: bin_op(ctx.mod.i64x2.extmul_low_i32x4_u),
            extmul_high: bin_op(ctx.mod.i64x2.extmul_high_i32x4_u),
            extend_high: unary_op(ctx.mod.i64x2.extend_high_i32x4_u),
            extend_low: unary_op(ctx.mod.i64x2.extend_low_i32x4_u),
            narrow: bin_op(ctx.mod.i16x8.narrow_i32x4_u),
            extract: extract_op(ctx.mod.i32x4.extract_lane, ctx.types.u32),
            replace: replace_op(ctx.mod.i32x4.replace_lane, ctx.types.u32x4)
        },
        i64x2: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            all_true: unary_op(ctx.mod.i64x2.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i64x2.bitmask, ctx.types.i32),
            abs: unary_op(ctx.mod.i64x2.abs),
            extract: extract_op(ctx.mod.i64x2.extract_lane, ctx.types.i64),
            replace: replace_op(ctx.mod.i64x2.replace_lane, ctx.types.i64x2)
        },
        u64x2: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            all_true: unary_op(ctx.mod.i64x2.all_true, ctx.types.i32),
            bitmask: unary_op(ctx.mod.i64x2.bitmask, ctx.types.i32),
            abs: unary_op(ctx.mod.i64x2.abs),
            extract: extract_op(ctx.mod.i64x2.extract_lane, ctx.types.u64),
            replace: replace_op(ctx.mod.i64x2.replace_lane, ctx.types.u64x2)
        },
        f32x4: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            abs: unary_op(ctx.mod.f32x4.abs),
            sqrt: unary_op(ctx.mod.f32x4.sqrt),
            min: bin_op(ctx.mod.f32x4.min),
            max: bin_op(ctx.mod.f32x4.max),
            pmin: bin_op(ctx.mod.f32x4.pmin),
            pmax: bin_op(ctx.mod.f32x4.pmax),
            ceil: unary_op(ctx.mod.f32x4.ceil),
            floor: unary_op(ctx.mod.f32x4.floor),
            trunc: unary_op(ctx.mod.f32x4.trunc),
            nearest: unary_op(ctx.mod.f32x4.nearest),
            trunc_sat_s: unary_op(ctx.mod.i32x4.trunc_sat_f32x4_s),
            trunc_sat_u: unary_op(ctx.mod.i32x4.trunc_sat_f32x4_u),
            promote_low: unary_op(ctx.mod.f64x2.promote_low_f32x4),
            extract: extract_op(ctx.mod.f32x4.extract_lane, ctx.types.f32),
            replace: replace_op(ctx.mod.f32x4.replace_lane, ctx.types.f32x4)
        },
        f64x2: {
            bitselect: ternary_op(ctx.mod.v128.bitselect),
            andnot: bin_op(ctx.mod.v128.andnot),
            any_true: unary_op(ctx.mod.v128.any_true, ctx.types.i32),
            abs: unary_op(ctx.mod.f64x2.abs),
            sqrt: unary_op(ctx.mod.f64x2.sqrt),
            min: bin_op(ctx.mod.f64x2.min),
            max: bin_op(ctx.mod.f64x2.max),
            pmin: bin_op(ctx.mod.f64x2.pmin),
            pmax: bin_op(ctx.mod.f64x2.pmax),
            ceil: unary_op(ctx.mod.f64x2.ceil),
            floor: unary_op(ctx.mod.f64x2.floor),
            trunc: unary_op(ctx.mod.f64x2.trunc),
            nearest: unary_op(ctx.mod.f64x2.nearest),
            trunc_sat_zero_s: unary_op(ctx.mod.i32x4.trunc_sat_f64x2_s_zero),
            trunc_sat_zero_u: unary_op(ctx.mod.i32x4.trunc_sat_f64x2_u_zero),
            demote_zero: unary_op(ctx.mod.f32x4.demote_f64x2_zero),
            extract: extract_op(ctx.mod.f64x2.extract_lane, ctx.types.f64),
            replace: replace_op(ctx.mod.f64x2.replace_lane, ctx.types.f64x2)
        }
    };
}

/*
this is going to have to be:
1. identify all structs in the file (eventually including imports)
2. create dependency graph of which structs depend on which other structs
3. topologically sort the structs (if there are any cycles, throw an error)
4. determine sizeofs in that order
*/
export function identifyStructs(program: Program): StructTypeInformation[] {
    const struct_declarations = Object.fromEntries(
        program.body
            .map((x) => (x.type === "ExportNamedDeclaration" ? x.declaration : x))
            .filter((x): x is StructDeclaration => x.type === "StructDeclaration")
            .map((x) => [x.id.name, x])
    );
    const adj_list = new Map(
        Object.entries(struct_declarations).map(([id, { fields }]) => [
            id,
            new Set(
                fields
                    .map((x) => x.typeAnnotation._type)
                    .filter(
                        (x): x is Extract<TypeIdentifier["_type"], { type: "Identifier" }> =>
                            x.type === "Identifier"
                    )
                    .map((x) => x.name)
                    .filter((x) => !Primitive.primitives.has(x))
            )
        ])
    );

    // detect cycles
    detectCycles(adj_list);

    const top_sorted_structs = topologicalSort(adj_list);
    if (top_sorted_structs.length !== Object.keys(struct_declarations).length) {
        throw new Error("Struct dependency graph is not connected, this is a compiler bug");
    }
    top_sorted_structs.reverse();

    const types = new Map<string, StructTypeInformation>();
    for (const struct of top_sorted_structs) {
        types.set(struct, structDeclarationToTypeInformation(types, struct_declarations[struct]));
    }
    return Array.from(types.values());
}

function detectCycles(adj_list: Map<string, Set<string>>) {
    const seen = new Set();
    for (const struct of adj_list.keys()) {
        if (seen.has(struct)) continue;
        const stack = [struct];
        const visited = new Set();
        while (stack.length > 0) {
            const vertex = stack.pop()!;
            if (visited.has(vertex)) {
                throw new Error(`Struct dependency cycle detected: ${vertex} uses itself`);
            }
            visited.add(vertex);
            seen.add(vertex);
            for (const adj_vertex of adj_list.get(vertex)!) {
                stack.push(adj_vertex);
            }
        }
    }
}

// and they said i would never use data structures and algorithms in real life....
function topologicalSort(adj_list: Map<string, Set<string>>): string[] {
    // kahn's algorithm
    const L: string[] = [];

    const has_incoming_edge = new Set(Array.from(adj_list.values(), (x) => Array.from(x)).flat());
    const S = Array.from(adj_list.keys()).filter((x) => !has_incoming_edge.has(x));

    // awful efficiency, should reverse the adjacency list and use a real queue
    // doesn't matter though because small N
    while (S.length) {
        const n = S.shift()!;
        L.push(n);
        for (const m of adj_list.get(n)!) {
            adj_list.get(n)!.delete(m);
            if (!Array.from(adj_list.values()).some((x) => x.has(m))) {
                S.push(m);
            }
        }
    }

    return L;
}

function structDeclarationToTypeInformation(
    structs: Map<string, StructTypeInformation>,
    node: StructDeclaration
): StructTypeInformation {
    const type: Omit<StructTypeInformation, "sizeof"> = {
        classification: "struct",
        name: node.id.name,
        fields: new Map(),
        methods: new Map()
    };

    let offset = 0;
    for (const { name, typeAnnotation } of node.fields) {
        const field_type = parseType(
            {
                ...Object.fromEntries(Primitive.primitives),
                ...Object.fromEntries(structs)
            } as Context["types"],
            typeAnnotation
        );

        type.fields.set(name.name, { type: field_type, offset });
        // TODO: alignment
        offset += field_type.is_ref ? Pointer.type.sizeof : field_type.sizeof;
    }

    return { ...type, sizeof: offset };
}

export function buildTypes(program: Program) {
    const structs = Object.fromEntries(identifyStructs(program).map((x) => [x.name, x]));
    const primitives = Object.fromEntries(Primitive.primitives.entries());

    const types = { ...primitives, ...structs, string: String_.type } as Context["types"];

    for (const {
        id: { name: struct_name },
        methods
    } of program.body
        .map((x) => (x.type === "ExportNamedDeclaration" ? x.declaration : x))
        .filter((x): x is StructDeclaration => x.type === "StructDeclaration")) {
        for (const { id, params, returnType } of methods) {
            const method_type = {
                classification: "function",
                name: `${struct_name}.${id.name}`,
                sizeof: 0,
                implementation: {
                    params: params.map(({ name, typeAnnotation }) => ({
                        name: name.name,
                        type: parseType(types, typeAnnotation)
                    })),
                    results: parseType(types, returnType)
                },
                is_ref: false
            } satisfies InstanceFunctionTypeInformation;

            (types[struct_name] as InstanceStructTypeInformation).methods.set(id.name, method_type);
        }
    }

    return types;
}

export function getExportables(program: Program, types: Context["types"] = buildTypes(program)) {
    const exports: Record<string, FunctionTypeInformation | StructTypeInformation> = {};
    for (const export_ of program.body
        .filter((x): x is ExportNamedDeclaration => x.type === "ExportNamedDeclaration")
        .map((x) => x.declaration)) {
        if (export_.type === "StructDeclaration") {
            exports[export_.id.name] = types[export_.id.name] as StructTypeInformation;
        } else if (export_.type === "FunctionDeclaration") {
            exports[export_.id.name] = {
                classification: "function",
                name: export_.id.name,
                sizeof: 0,
                implementation: {
                    params: export_.params.map(({ name, typeAnnotation }) => ({
                        name: name.name,
                        type: parseType(types, typeAnnotation)
                    })),
                    results: parseType(types, export_.returnType)
                }
            };
        }
    }
    return exports;
}
