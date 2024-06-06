import binaryen from "binaryen";
import { MiteType } from "../backend/type_classes.js";

export type ProgramToModuleOptions = unknown;

export interface StructField {
    offset: number;
    type: InstanceTypeInformation;
}

interface SharedTypeInformation {
    classification: string;
    name: string;
    sizeof: number;
}

export interface ArrayTypeInformation extends SharedTypeInformation {
    classification: "array";
    element_type: InstanceTypeInformation;
    length?: number;
}
export interface StructTypeInformation extends SharedTypeInformation {
    classification: "struct";
    fields: Map<string, StructField>;
    methods: Map<string, InstanceFunctionTypeInformation>;
}
export interface PrimitiveTypeInformation extends SharedTypeInformation {
    classification: "primitive";
    binaryen_type: binaryen.Type;
}
export interface FunctionTypeInformation extends SharedTypeInformation {
    classification: "function";
    implementation: FunctionInformation;
}
export interface StringTypeInformation extends SharedTypeInformation {
    classification: "string";
    name: "string";
}

export type TypeInformation =
    | PrimitiveTypeInformation
    | StructTypeInformation
    | ArrayTypeInformation
    | FunctionTypeInformation
    | StringTypeInformation;

interface SharedInstanceTypeInformation {
    is_ref: boolean;
}

type Instance<T> = SharedInstanceTypeInformation & T;

export interface InstanceArrayTypeInformation extends Instance<ArrayTypeInformation> {}
export interface InstanceStructTypeInformation extends Instance<StructTypeInformation> {}
export interface InstancePrimitiveTypeInformation extends PrimitiveTypeInformation {
    is_ref?: boolean;
}
export interface InstanceFunctionTypeInformation extends Instance<FunctionTypeInformation> {}
export interface InstanceStringTypeInformation extends Instance<StringTypeInformation> {
    is_ref: true;
}

export type InstanceTypeInformation =
    | InstancePrimitiveTypeInformation
    | InstanceStructTypeInformation
    | InstanceArrayTypeInformation
    | InstanceFunctionTypeInformation
    | InstanceStringTypeInformation;

interface Parameter {
    name: string;
    type: InstanceTypeInformation;
}

export interface FunctionInformation {
    params: Parameter[];
    results: InstanceTypeInformation;
}

export interface Context {
    /** The binaryen module */
    mod: binaryen.Module;
    /** Variables defined in this scope */
    variables: Map<string, MiteType>;
    /** The return type expected from the current expression. Used for literal coercion. */
    expected?: InstanceTypeInformation;
    /** Types and their intrinsics */
    intrinsics: Record<string, IntrinsicHandlers>;
    /** Type conversions */
    conversions: Record<string, ConversionHandlers>;
    /** Types and their information */
    types: {
        void: PrimitiveTypeInformation;
        bool: PrimitiveTypeInformation;
        i8: PrimitiveTypeInformation;
        i16: PrimitiveTypeInformation;
        i32: PrimitiveTypeInformation;
        i64: PrimitiveTypeInformation;
        u8: PrimitiveTypeInformation;
        u16: PrimitiveTypeInformation;
        u32: PrimitiveTypeInformation;
        u64: PrimitiveTypeInformation;
        f32: PrimitiveTypeInformation;
        f64: PrimitiveTypeInformation;
        v128: PrimitiveTypeInformation;
        i8x16: PrimitiveTypeInformation;
        u8x16: PrimitiveTypeInformation;
        i16x8: PrimitiveTypeInformation;
        u16x8: PrimitiveTypeInformation;
        i32x4: PrimitiveTypeInformation;
        u32x4: PrimitiveTypeInformation;
        f32x4: PrimitiveTypeInformation;
        i64x2: PrimitiveTypeInformation;
        u64x2: PrimitiveTypeInformation;
        f64x2: PrimitiveTypeInformation;
        string: InstanceStringTypeInformation;
    } & Record<string, TypeInformation>;
    /** Depth stacks for use in nested blocks and such */
    stacks: {
        continue: string[];
        break: string[];
        depth: number;
    };
    /** The current block */
    current_block: MiteType[];
    /** All captured functions that will go into the virtualized_functions table */
    captured_functions: string[];
    /** String literal management */
    string: {
        /** Associates strings to their pointer in memory */
        literals: Map<string, number>;
        /** End of string section / start of next string inserted */
        end: number;
    };
    /** constants that don't fit elsewhere */
    constants: {
        RESERVED_FN_PTRS: number;
    };
    /** Data about current function */
    current_function: FunctionInformation & {
        local_count: number;
        is_init: boolean;
    };
}

export type TernaryOperator = (left: MiteType, middle: MiteType, right: MiteType) => MiteType;
export type BinaryOperator = (left: MiteType, right: MiteType) => MiteType;
export type UnaryOperator = (expr: MiteType) => MiteType;
export type NullaryOperator = () => MiteType;

export type ConversionHandlers = Record<string, UnaryOperator>;

export type OperatorHandlers = Partial<{
    add: BinaryOperator;
    sub: BinaryOperator;
    mul: BinaryOperator;
    div: BinaryOperator;
    eq: BinaryOperator;
    ne: BinaryOperator;
    lt: BinaryOperator;
    lte: BinaryOperator;
    gt: BinaryOperator;
    gte: BinaryOperator;
    shl: BinaryOperator;
    shr: BinaryOperator;
    mod: BinaryOperator;
    and: BinaryOperator;
    or: BinaryOperator;
    xor: BinaryOperator;
}>;

export const intrinsic_names = new Set([
    "clz",
    "ctz",
    "popcnt",
    "rotl",
    "rotr",
    "abs",
    "ceil",
    "floor",
    "trunc",
    "nearest",
    "sqrt",
    "min",
    "max",
    "copysign",
    "reinterpret",

    "bitselect",
    "andnot",
    "any_true",
    "splat",
    "all_true",
    "bitmask",
    "narrow",
    "extmul_low",
    "extmul_high",
    "extadd_pairwise",
    "extend_low",
    "extend_high",
    "add_sat",
    "sub_sat",
    "swizzle",
    "avgr",
    "q15mulr",
    "dot",
    "trunc_sat_zero_u",
    "trunc_sat_zero_s",
    "trunc_sat_u",
    "trunc_sat_s",
    "pmin",
    "pmax",
    "demote_zero",
    "convert_low",
    "promote_low",
    "extract",
    "replace"
]) as Omit<Set<string>, "has"> & { has: (name: string) => name is keyof IntrinsicHandlers };
export type IntrinsicHandlers = Partial<{
    clz: UnaryOperator;
    ctz: UnaryOperator;
    popcnt: UnaryOperator;
    rotl: BinaryOperator;
    rotr: BinaryOperator;
    abs: UnaryOperator;
    ceil: UnaryOperator;
    floor: UnaryOperator;
    trunc: UnaryOperator;
    nearest: UnaryOperator;
    sqrt: UnaryOperator;
    min: BinaryOperator;
    max: BinaryOperator;
    copysign: BinaryOperator;
    reinterpret: UnaryOperator;

    // simd
    // v128
    bitselect: TernaryOperator;
    andnot: BinaryOperator;
    any_true: UnaryOperator;

    // commmon
    splat: UnaryOperator;
    all_true: UnaryOperator;
    bitmask: UnaryOperator;
    narrow: BinaryOperator;
    extmul_low: BinaryOperator;
    extmul_high: BinaryOperator;
    extadd_pairwise: UnaryOperator;
    extend_low: UnaryOperator;
    extend_high: UnaryOperator;
    add_sat: BinaryOperator;
    sub_sat: BinaryOperator;
    extract: BinaryOperator;
    replace: TernaryOperator;

    // i8x16
    // limited by syntax right now
    shuffle: (left: MiteType, right: MiteType, mask: MiteType) => MiteType;
    swizzle: BinaryOperator;
    avgr: BinaryOperator;

    // i16x8
    q15mulr: BinaryOperator;

    // i32x4
    dot: BinaryOperator;
    // todo: these are ugly, shouldn't need _{u,s}
    trunc_sat_zero_u: UnaryOperator;
    trunc_sat_zero_s: UnaryOperator;
    trunc_sat_u: UnaryOperator;
    trunc_sat_s: UnaryOperator;

    // f32x4
    pmin: BinaryOperator;
    pmax: BinaryOperator;
    demote_zero: UnaryOperator;

    // f64x2
    convert_low: UnaryOperator;
    promote_low: UnaryOperator;
}>;
