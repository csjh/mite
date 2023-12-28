// don't be offput by the fact this is 3000 lines, it's almost all boilerplate

import binaryen from "binaryen";
import { StructTypeInformation, TypeInformation, Context } from "../types/code_gen.js";
import { Program, StructDeclaration } from "../types/nodes.js";
import { Primitive } from "./type_classes.js";

export function createConversions(mod: binaryen.Module): Context["conversions"] {
    // convert from type1 to type2 is obj[type1][type2]
    return {
        i32: {
            i32: (value) => value,
            u32: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.extend_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            // TODO: make sure extend_s is proper, should be though
            u64: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.extend_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.convert_s.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.convert_s.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i32x4: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            // TODO: remove these when i8, i16 are implemented
            i16x8: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i8x16: (value) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u32: {
            i32: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => value,
            i64: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.extend_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.extend_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.convert_u.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.convert_u.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32x4: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            // TODO: remove these when u8, u16 are implemented
            u16x8: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u8x16: (value) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i64: {
            i32: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => value,
            u64: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.convert_s.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.convert_s.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64x2: (value) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u64: {
            i32: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.extend_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => value,
            f32: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.convert_u.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.convert_u.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64x2: (value) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f32: {
            i32: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.trunc_s_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.trunc_u_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.trunc_s_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.trunc_u_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => value,
            f64: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.promote(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32x4: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f64: {
            i32: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.trunc_s_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.trunc_u_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.trunc_s_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.trunc_u_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.demote(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => value,
            f64x2: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.splat(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        v128: {
            v128: (value) => value,
            i8x16: (value) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u8x16: (value) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i16x8: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u16x8: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i32x4: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u32x4: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            f32x4: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i64x2: (value) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u64x2: (value) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            f64x2: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i8x16: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i8x16: (value) => value,
            u8x16: (value) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u8x16: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i8x16: (value) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u8x16: (value) => value
        },
        i16x8: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i16x8: (value) => value,
            u16x8: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u16x8: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i16x8: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u16x8: (value) => value
        },
        i32x4: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i32x4: (value) => value,
            u32x4: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            f32x4: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.convert_i32x4_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u32x4: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i32x4: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u32x4: (value) => value,
            f32x4: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.convert_i32x4_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f32x4: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i32x4: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.trunc_sat_f32x4_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32x4: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.trunc_sat_f32x4_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32x4: (value) => value
        },
        i64x2: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i64x2: (value) => value,
            u64x2: (value) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u64x2: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i64x2: (value) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u64x2: (value) => value
        },
        f64x2: {
            v128: (value) => ({
                type: Primitive.primitives.get("v128")!,
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            f64x2: (value) => value
        }
    };
}

export function createIntrinsics(mod: binaryen.Module): Context["intrinsics"] {
    return {
        void: {},
        f32: {
            sqrt: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.sqrt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ceil: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.ceil(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            floor: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.floor(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.trunc(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            nearest: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.nearest(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            abs: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.abs(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            copysign: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.copysign(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.min(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.max(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f64: {
            sqrt: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.sqrt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ceil: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.ceil(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            floor: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.floor(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.trunc(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            nearest: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.nearest(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            abs: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.abs(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            copysign: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.copysign(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.min(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.max(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i32: {
            clz: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u32: {
            clz: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i64: {
            clz: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u64: {
            clz: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        v128: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("v128")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("v128")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i8x16: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            swizzle: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.swizzle(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i8x16.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            add_sat: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.add_saturate_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub_sat: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.sub_saturate_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.min_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.max_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            dot: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.dot_i16x8_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_low: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.extmul_low_i8x16_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_high: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.extmul_high_i8x16_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extadd_pairwise: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.extadd_pairwise_i8x16_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_low: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.extend_low_i8x16_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_high: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.extend_high_i8x16_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i32")!,
                    ref: mod.i8x16.extract_lane_s(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i8x16")!,
                    ref: mod.i8x16.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        u8x16: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            swizzle: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.swizzle(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i8x16.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            add_sat: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.add_saturate_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub_sat: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.sub_saturate_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.min_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.max_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            avgr: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.avgr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_low: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.extmul_low_i8x16_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_high: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.extmul_high_i8x16_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extadd_pairwise: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.extadd_pairwise_i8x16_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_low: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.extend_low_i8x16_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_high: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.extend_high_i8x16_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u32")!,
                    ref: mod.i8x16.extract_lane_u(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u8x16")!,
                    ref: mod.i8x16.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        i16x8: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i16x8.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            add_sat: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.add_saturate_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub_sat: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.sub_saturate_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.min_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.max_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            q15mulr: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.q15mulr_sat_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_low: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.extmul_low_i16x8_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_high: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.extmul_high_i16x8_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extadd_pairwise: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.extadd_pairwise_i16x8_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_low: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.extend_low_i16x8_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_high: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.extend_high_i16x8_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            narrow: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.narrow_i16x8_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i32")!,
                    ref: mod.i16x8.extract_lane_s(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i16x8")!,
                    ref: mod.i16x8.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        u16x8: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i16x8.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            add_sat: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.add_saturate_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub_sat: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.sub_saturate_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.min_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.max_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            avgr: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.avgr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_low: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.extmul_low_i16x8_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_high: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.extmul_high_i16x8_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extadd_pairwise: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.extadd_pairwise_i16x8_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_low: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.extend_low_i16x8_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_high: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.extend_high_i16x8_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            narrow: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.narrow_i16x8_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i32")!,
                    ref: mod.i16x8.extract_lane_u(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u16x8")!,
                    ref: mod.i16x8.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        i32x4: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32x4.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.min_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.max_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            narrow: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.narrow_i32x4_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_high: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.extmul_high_i32x4_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_low: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.extmul_low_i32x4_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_high: (value) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.extend_high_i32x4_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_low: (value) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.extend_low_i32x4_s(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i32")!,
                    ref: mod.i32x4.extract_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i32x4")!,
                    ref: mod.i32x4.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        u32x4: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32x4.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.min_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.max_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            narrow: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.narrow_i32x4_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_high: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.extmul_high_i32x4_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extmul_low: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.extmul_low_i32x4_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_high: (value) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.extend_high_i32x4_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extend_low: (value) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.extend_low_i32x4_u(value.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u32")!,
                    ref: mod.i32x4.extract_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u32x4")!,
                    ref: mod.i32x4.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        i64x2: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64x2.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i64")!,
                    ref: mod.i64x2.extract_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.SIMDExtract
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("i64x2")!,
                    ref: mod.i64x2.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.SIMDReplace
                };
            }
        },
        u64x2: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            all_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64x2.all_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            bitmask: (value) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.bitmask(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u64")!,
                    ref: mod.i64x2.extract_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.SIMDExtract
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("u64x2")!,
                    ref: mod.i64x2.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.SIMDReplace
                };
            }
        },
        f32x4: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            abs: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.abs(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            sqrt: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.sqrt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.min(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.max(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            pmin: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.pmin(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            pmax: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.pmax(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ceil: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.ceil(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            floor: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.floor(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.trunc(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            nearest: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.nearest(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc_sat_s: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.trunc_sat_f32x4_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc_sat_u: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.trunc_sat_f32x4_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            promote_low: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.promote_low_f32x4(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("f32")!,
                    ref: mod.f32x4.extract_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("f32")!,
                    ref: mod.f32x4.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        },
        f64x2: {
            bitselect: (left, right, control_mask) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.v128.bitselect(left.ref, right.ref, control_mask.ref),
                expression: binaryen.ExpressionIds.Select
            }),
            andnot: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.v128.andnot(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            any_true: (value) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.v128.any_true(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            abs: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.abs(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            sqrt: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.sqrt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            min: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.min(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.max(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            pmin: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.pmin(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            pmax: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.pmax(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ceil: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.ceil(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            floor: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.floor(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.trunc(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            nearest: (value) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.nearest(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc_sat_zero_s: (value) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.trunc_sat_f64x2_s_zero(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc_sat_zero_u: (value) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.trunc_sat_f64x2_u_zero(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            demote_zero: (value) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.demote_f64x2_zero(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            extract(value, index) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("f64")!,
                    ref: mod.f64x2.extract_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref)
                    ),
                    expression: binaryen.ExpressionIds.Unary
                };
            },
            replace(value, index, replacement) {
                if (index.expression !== binaryen.ExpressionIds.Const)
                    throw new Error("Expected constant extraction index");
                return {
                    type: Primitive.primitives.get("f64x2")!,
                    ref: mod.f64x2.replace_lane(
                        value.ref,
                        // @ts-expect-error undocumented function
                        binaryen._BinaryenConstGetValueI32(index.ref),
                        replacement.ref
                    ),
                    expression: binaryen.ExpressionIds.Select
                };
            }
        }
    };
}

// this is so bad
export function createTypeOperations(mod: binaryen.Module): Context["operators"] {
    return {
        void: {},
        f32: {
            add: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("f32")!,
                ref: mod.f32.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f32.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f32.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f32.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f32.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        f64: {
            add: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.f64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("f64")!,
                ref: mod.f64.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i32: {
            add: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.div_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.rem_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i32.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u32: {
            add: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.div_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.rem_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("u32")!,
                ref: mod.i32.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i64: {
            add: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.div_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.rem_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("i64")!,
                ref: mod.i64.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u64: {
            add: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.div_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i32")!,
                ref: mod.i64.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.rem_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("u64")!,
                ref: mod.i64.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i8x16: {
            and: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("i8x16")!,
                ref: mod.i8x16.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u8x16: {
            and: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("u8x16")!,
                ref: mod.i8x16.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i16x8: {
            and: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("i16x8")!,
                ref: mod.i16x8.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u16x8: {
            and: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("u16x8")!,
                ref: mod.i16x8.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i32x4: {
            and: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("i32x4")!,
                ref: mod.i32x4.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u32x4: {
            and: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("u32x4")!,
                ref: mod.i32x4.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i64x2: {
            and: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("i64x2")!,
                ref: mod.i64x2.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u64x2: {
            and: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.v128.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.v128.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.v128.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            add: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: Primitive.primitives.get("u64x2")!,
                ref: mod.i64x2.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        f32x4: {
            add: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("f32x4")!,
                ref: mod.f32x4.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        f64x2: {
            add: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: Primitive.primitives.get("f64x2")!,
                ref: mod.f64x2.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
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
export function identifyStructs(program: Program): TypeInformation[] {
    const struct_declarations = Object.fromEntries(
        program.body
            .filter((x): x is StructDeclaration => x.type === "StructDeclaration")
            .map((x) => [x.id.name, x])
    );
    const adj_list = new Map(
        Object.entries(struct_declarations).map(([id, { fields }]) => [
            id,
            new Set(
                fields
                    .map(({ typeAnnotation }) => typeAnnotation.name)
                    .filter((name) => !Primitive.primitives.has(name))
            )
        ])
    ) as Map<string, Set<string>>;

    // detect cycles
    const cycle_error = detectCycles(adj_list);
    if (cycle_error) throw cycle_error;

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

function detectCycles(adj_list: Map<string, Set<string>>): Error | null {
    const seen = new Set();
    for (const struct of adj_list.keys()) {
        if (seen.has(struct)) continue;
        const stack = [struct];
        const visited = new Set();
        while (stack.length > 0) {
            const vertex = stack.pop()!;
            if (visited.has(vertex)) {
                return new Error(`Struct dependency cycle detected: ${vertex} uses itself`);
            }
            visited.add(vertex);
            seen.add(vertex);
            for (const adj_vertex of adj_list.get(vertex)!) {
                stack.push(adj_vertex);
            }
        }
    }
    return null;
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
    const type = {
        classification: "struct",
        name: node.id.name,
        fields: new Map()
    } as const;

    let offset = 0;
    for (const { name, typeAnnotation } of node.fields) {
        if (Primitive.primitives.has(typeAnnotation.name)) {
            const sizeof = Primitive.sizeof(typeAnnotation.name)!;
            type.fields.set(name.name, {
                type: Primitive.primitives.get(typeAnnotation.name)!,
                offset
            });
            // TODO: alignment
            offset += sizeof;
        } else if (structs.has(typeAnnotation.name)) {
            const struct = structs.get(typeAnnotation.name)!;
            type.fields.set(name.name, { type: struct, offset });
            offset += struct.sizeof;
        } else {
            // probably array
            throw new Error(`Unknown type: ${typeAnnotation.name}`);
        }
    }

    return { ...type, sizeof: offset };
}
