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
                type: { classification: "primitive", name: "u32" },
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.extend_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            // TODO: make sure extend_s is proper, should be though
            u64: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.extend_s(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.convert_s.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.convert_s.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u32: {
            i32: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => value,
            i64: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.extend_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.extend_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.convert_u.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.convert_u.i32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i64: {
            i32: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => value,
            u64: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: value.ref,
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.convert_s.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.convert_s.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u64: {
            i32: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.wrap(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.extend_u(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => value,
            f32: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.convert_u.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.convert_u.i64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f32: {
            i32: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.trunc_s_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.trunc_u_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.trunc_s_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.trunc_u_sat.f32(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => value,
            f64: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.promote(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f64: {
            i32: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.trunc_s_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u32: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.trunc_u_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            i64: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.trunc_s_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            u64: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.trunc_u_sat.f64(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f32: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.demote(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            f64: (value) => value
        }
    };
}

export function createIntrinsics(mod: binaryen.Module): Context["intrinsics"] {
    return {
        f32: {
            sqrt: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.sqrt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ceil: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.ceil(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            floor: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.floor(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.trunc(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            nearest: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.nearest(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            abs: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.abs(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            copysign: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.copysign(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.min(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.max(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        f64: {
            sqrt: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.sqrt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ceil: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.ceil(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            floor: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.floor(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            trunc: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.trunc(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            nearest: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.nearest(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            abs: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.abs(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            copysign: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.copysign(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            min: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.min(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            max: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.max(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i32: {
            clz: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u32: {
            clz: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        i64: {
            clz: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        u64: {
            clz: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.clz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            ctz: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.ctz(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            popcnt: (value) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.popcnt(value.ref),
                expression: binaryen.ExpressionIds.Unary
            }),
            rotl: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.rotl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            rotr: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.rotr(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            reinterpret: (value) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.reinterpret(value.ref),
                expression: binaryen.ExpressionIds.Unary
            })
        },
        void: {}
    };
}

// this is so bad
export function createTypeOperations(mod: binaryen.Module): Context["operators"] {
    return {
        f32: {
            add: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: { classification: "primitive", name: "f32" },
                ref: mod.f32.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f32.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f32.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f32.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f32.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        f64: {
            add: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.div(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.f64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.lt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.le(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.gt(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: { classification: "primitive", name: "f64" },
                ref: mod.f64.ge(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i32: {
            add: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.div_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.rem_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i32.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u32: {
            add: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.div_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.rem_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: { classification: "primitive", name: "u32" },
                ref: mod.i32.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        i64: {
            add: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.div_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.lt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.le_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.gt_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.ge_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.shr_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.rem_s(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: { classification: "primitive", name: "i64" },
                ref: mod.i64.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        u64: {
            add: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.add(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            sub: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.sub(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mul: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.mul(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            div: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.div_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            eq: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.eq(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            ne: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.ne(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.lt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            lte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.le_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gt: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.gt_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            gte: (left, right) => ({
                type: { classification: "primitive", name: "i32" },
                ref: mod.i64.ge_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shl: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.shl(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            shr: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.shr_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            mod: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.rem_u(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            and: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.and(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            or: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.or(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            }),
            xor: (left, right) => ({
                type: { classification: "primitive", name: "u64" },
                ref: mod.i64.xor(left.ref, right.ref),
                expression: binaryen.ExpressionIds.Binary
            })
        },
        void: {
            add: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            sub: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            mul: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            div: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            eq: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            ne: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            lt: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            lte: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            gt: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
            }),
            gte: () => ({
                type: { classification: "primitive", name: "void" },
                ref: mod.nop(),
                expression: binaryen.ExpressionIds.Nop
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
    for (const [struct] of adj_list) {
        if (seen.has(struct)) continue;
        const stack = [struct];
        const visited = new Set();
        while (stack.length > 0) {
            const vertex = stack.pop()!;
            if (visited.has(vertex)) {
                return new Error(`Struct dependency cycle detected: ${vertex}`);
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

function topologicalSort(adj_list: Map<string, Set<string>>): string[] {
    // kahn's algorithm
    const L: string[] = [];

    const has_incoming_edge = new Set(Array.from(adj_list.values(), (x) => Array.from(x)).flat());
    const S = new Set<string>(Array.from(adj_list.keys()).filter((x) => !has_incoming_edge.has(x)));

    while (S.size) {
        const n = S.values().next().value;
        S.delete(n);
        L.push(n);
        for (const m of adj_list.get(n)!) {
            adj_list.get(n)!.delete(m);
            if (!adj_list.get(m)!.size) {
                S.add(m);
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
