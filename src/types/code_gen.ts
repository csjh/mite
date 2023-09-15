import binaryen from "binaryen";

export const allTypes = [
    ["void", binaryen.none],
    ["i64", binaryen.i64],
    ["i32", binaryen.i32],
    ["f64", binaryen.f64],
    ["f32", binaryen.f32]
] as const;

export const types = new Map(allTypes);

export type VariableInformation = {
    type: "i32" | "i64" | "f32" | "f64"; // string
    binaryenType: binaryen.Type; // convenience conversion of above
    index: number;
};

export type FunctionInformation = {
    ref: binaryen.FunctionRef;
};

export type Context = {
    mod: binaryen.Module;
    variables: Map<string, VariableInformation>;
    functions: Map<string, FunctionInformation>;
    expected?: Omit<VariableInformation, "index">;
    current_function: binaryen.FunctionInfo;
};
