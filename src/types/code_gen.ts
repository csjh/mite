import binaryen from "binaryen";
import { AllocationLocation, LinearMemoryLocation, MiteType } from "../backend/type_classes.js";

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
    length: number;
};
export type StructTypeInformation = SharedTypeInformation & {
    classification: "struct";
    fields: Map<string, { type: TypeInformation; offset: number; is_ref: boolean }>;
};
export type PrimitiveTypeInformation = SharedTypeInformation & {
    classification: "primitive";
};
export type TypeInformation =
    | PrimitiveTypeInformation
    | StructTypeInformation
    | ArrayTypeInformation;

type SharedInstanceTypeInformation<Location extends AllocationLocation> = {
    location: Location;
    is_ref: boolean;
    immutable: boolean;
};

export type InstanceArrayTypeInformation = ArrayTypeInformation &
    SharedInstanceTypeInformation<LinearMemoryLocation>;
export type InstanceStructTypeInformation = StructTypeInformation &
    SharedInstanceTypeInformation<LinearMemoryLocation>;
export type InstancePrimitiveTypeInformation = PrimitiveTypeInformation &
    Partial<SharedInstanceTypeInformation<AllocationLocation>>;

export type InstanceTypeInformation =
    | InstancePrimitiveTypeInformation
    | InstanceStructTypeInformation
    | InstanceArrayTypeInformation;

export type ExpressionInformation = {
    type: InstanceTypeInformation;
    expression: binaryen.ExpressionIds;
    ref: binaryen.ExpressionRef;
};

export type FunctionInformation = {
    params: InstanceTypeInformation[];
    results: InstanceTypeInformation;
};

export type Context = {
    /** The binaryen module */
    mod: binaryen.Module;
    /** Variables defined in this scope */
    variables: Map<string, MiteType>;
    /** Functions defined in this scope */
    functions: Map<string, FunctionInformation>;
    /** The return type expected from the current expression. Used for literal coercion. */
    expected?: InstanceTypeInformation;
    /** Types and their intrinsics */
    intrinsics: Record<string, IntrinsicHandlers>;
    /** Type conversions */
    conversions: Record<string, ConversionHandlers>;
    /** Types and their information */
    types: {
        void: InstancePrimitiveTypeInformation;
        i32: InstancePrimitiveTypeInformation;
        i64: InstancePrimitiveTypeInformation;
        u32: InstancePrimitiveTypeInformation;
        u64: InstancePrimitiveTypeInformation;
        f32: InstancePrimitiveTypeInformation;
        f64: InstancePrimitiveTypeInformation;
        i8x16: InstancePrimitiveTypeInformation;
        u8x16: InstancePrimitiveTypeInformation;
        i16x8: InstancePrimitiveTypeInformation;
        u16x8: InstancePrimitiveTypeInformation;
        i32x4: InstancePrimitiveTypeInformation;
        u32x4: InstancePrimitiveTypeInformation;
        f32x4: InstancePrimitiveTypeInformation;
        i64x2: InstancePrimitiveTypeInformation;
        u64x2: InstancePrimitiveTypeInformation;
        f64x2: InstancePrimitiveTypeInformation;
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
    current_block: ExpressionInformation[];
    /** Data about current function */
    current_function: FunctionInformation & {
        stack_frame_size: number;
        local_count: number;
    };
};

export type TernaryOperator = (
    left: ExpressionInformation,
    middle: ExpressionInformation,
    right: ExpressionInformation
) => ExpressionInformation;
export type BinaryOperator = (left: MiteType, right: MiteType) => MiteType;
export type UnaryOperator = (expr: ExpressionInformation) => ExpressionInformation;

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
]);
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
    // shuffle: (
    //     left: ExpressionInformation,
    //     right: ExpressionInformation,
    //     mask: number[]
    // ) => ExpressionInformation;
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
