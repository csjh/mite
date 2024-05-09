import binaryen from "binaryen";
import { MiteType } from "../backend/type_classes.js";

export type ProgramToModuleOptions = {
    stack_size?: number;
};

type SharedTypeInformation = {
    classification: string;
    name: string;
    sizeof: number;
};

export type ArrayTypeInformation = SharedTypeInformation & {
    classification: "array";
    element_type: InstanceTypeInformation;
    length?: number;
};
export type StructTypeInformation = SharedTypeInformation & {
    classification: "struct";
    fields: Map<string, { type: InstanceTypeInformation; offset: number; is_ref: boolean }>;
    methods: Map<string, InstanceFunctionInformation>;
};
export type PrimitiveTypeInformation = SharedTypeInformation & {
    classification: "primitive";
};
export type DirectFunctionInformation = SharedTypeInformation & {
    classification: "function";
    implementation: FunctionInformation;
};

export type TypeInformation =
    | PrimitiveTypeInformation
    | StructTypeInformation
    | ArrayTypeInformation
    | DirectFunctionInformation;

type SharedInstanceTypeInformation = {
    is_ref: boolean;
};

export type InstanceArrayTypeInformation = ArrayTypeInformation & SharedInstanceTypeInformation;
export type InstanceStructTypeInformation = StructTypeInformation & SharedInstanceTypeInformation;
export type InstancePrimitiveTypeInformation = PrimitiveTypeInformation & {
    is_ref?: boolean;
};
export type InstanceFunctionInformation = DirectFunctionInformation & {
    is_ref?: boolean;
};

export type InstanceTypeInformation =
    | InstancePrimitiveTypeInformation
    | InstanceStructTypeInformation
    | InstanceArrayTypeInformation
    | InstanceFunctionInformation;

export type FunctionInformation = {
    params: InstanceTypeInformation[];
    results: InstanceTypeInformation;
};

export type Context = {
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
    } & Record<string, TypeInformation>;
    /** Depth stacks for use in nested blocks and such */
    stacks: {
        continue: string[];
        break: string[];
        depth: number;
    };
    /** All declared structs in the program */
    structs: Record<string, Omit<StructTypeInformation, "instance">>;
    /** The current block */
    current_block: MiteType[];
    /** All captured functions that will go into the virtualized_functions table */
    captured_functions: string[];
    /** Data about current function */
    current_function: FunctionInformation & {
        stack_frame_size: number;
        local_count: number;
    };
};

export type TernaryOperator = (left: MiteType, middle: MiteType, right: MiteType) => MiteType;
export type BinaryOperator = (left: MiteType, right: MiteType) => MiteType;
export type UnaryOperator = (expr: MiteType) => MiteType;

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
