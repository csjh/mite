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

export type VariableInformation = {
    type: "i32" | "i64" | "f32" | "f64" | "void"; // string
    binaryenType: binaryen.Type; // convenience conversion of above
    index: number;
    isUnsigned?: boolean;
};

export type ExpressionInformation = Omit<VariableInformation, "index"> & {
    ref: binaryen.ExpressionRef;
};

export type FunctionInformation = {
    ref: binaryen.FunctionRef;
};

export type Context = {
    mod: binaryen.Module;
    variables: Map<string, VariableInformation>;
    functions: Map<string, FunctionInformation>;
    expected?: Omit<VariableInformation, "index">;
    type_operations: ReturnType<typeof import("../backend/utils.js").createTypeOperations>;
    current_function: {
        results: Omit<VariableInformation, "index">;
    };
};
