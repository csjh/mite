import binaryen from "binaryen";
import { MiteType } from "../backend/type_classes.js";

export type ProgramToModuleOptions = {
    stack_size?: number;
};

export type StructTypeInformation = {
    name: string;
    classification: "struct";
    fields: Map<string, { type: TypeInformation; offset: number }>;
    sizeof: number;
};
export type TypeInformation =
    | {
          name: string;
          classification: "primitive" | "array";
      }
    | StructTypeInformation;

export type ExpressionInformation = {
    type: TypeInformation;
    expression: binaryen.ExpressionIds;
    ref: binaryen.ExpressionRef;
};

export type FunctionInformation = {
    params: TypeInformation[];
    results: TypeInformation;
};

export type Context = {
    /** The binaryen module */
    mod: binaryen.Module;
    /** Variables defined in this scope */
    variables: Map<string, MiteType>;
    /** Functions defined in this scope */
    functions: Map<string, FunctionInformation>;
    /** The return type expected from the current expression. Used for literal coercion. */
    expected?: TypeInformation;
    /** Types and their operators */
    operators: Record<string, OperatorHandlers>;
    /** Types and their intrinsics */
    intrinsics: Record<string, IntrinsicHandlers>;
    /** Type conversions */
    conversions: Record<string, ConversionHandlers>;
    /** Types and their information */
    types: Record<string, TypeInformation>;
    /** Depth stacks for use in nested blocks and such */
    stacks: {
        continue: string[];
        break: string[];
        depth: number;
    };
    /** Data about current function */
    current_function: FunctionInformation & {
        stack_frame_size: number;
    };
};

export type BinaryOperator = (
    left: ExpressionInformation,
    right: ExpressionInformation
) => ExpressionInformation;
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
    "reinterpret"
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
}>;
