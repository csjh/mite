import binaryen from "binaryen";

export const allTypes = [
    ["void", binaryen.none],
    ["i64", binaryen.i64],
    ["i32", binaryen.i32],
    ["f64", binaryen.f64],
    ["f32", binaryen.f32],
    ["v128", binaryen.v128],
    ["funcref", binaryen.funcref],
    ["externref", binaryen.externref],
    ["anyref", binaryen.anyref],
    ["eqref", binaryen.eqref],
    ["i31ref", binaryen.i31ref],
    ["dataref", binaryen.dataref],
    ["stringref", binaryen.stringref],
    ["stringview_wtf8", binaryen.stringview_wtf8],
    ["stringview_wtf16", binaryen.stringview_wtf16],
    ["stringview_iter", binaryen.stringview_iter],
    ["unreachable", binaryen.unreachable],
    ["auto", binaryen.auto]
];

export const types = new Map(allTypes as [string, binaryen.Type][]);

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
