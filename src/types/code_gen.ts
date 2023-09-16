import binaryen from "binaryen";

export const allTypes = [
    ["void", binaryen.none],
    ["i64", binaryen.i64],
    ["i32", binaryen.i32],
    ["f64", binaryen.f64],
    ["f32", binaryen.f32]
] as const;

export const types = Object.fromEntries(allTypes) as {
    [key in (typeof allTypes)[number][0]]: binaryen.Type;
};

type VariableInformation = {
    type: "i32" | "i64" | "f32" | "f64" | "void"; // string
    binaryenType: binaryen.Type; // convenience conversion of above
    isUnsigned?: boolean;
};

export type LocalVariableInformation = VariableInformation & {
    index: number;
};

export type ExpressionInformation = VariableInformation & {
    ref: binaryen.ExpressionRef;
};

export type FunctionInformation = {
    params: VariableInformation[];
    results: VariableInformation;
};

export type Context = {
    mod: binaryen.Module;
    variables: Map<string, LocalVariableInformation>;
    functions: Map<string, FunctionInformation>;
    expected?: VariableInformation;
    type_operations: ReturnType<typeof import("../backend/utils.js").createTypeOperations>;
    current_function: {
        results: VariableInformation;
    };
};
