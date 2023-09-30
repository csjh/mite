import binaryen from "binaryen";

export enum TYPES {
    i64 = binaryen.i64,
    i32 = binaryen.i32,
    f64 = binaryen.f64,
    f32 = binaryen.f32,
    void = binaryen.none
}

type VariableInformation = {
    type: TYPES;
    isUnsigned?: boolean;
};

export type LocalVariableInformation = VariableInformation & {
    index: number;
};

export type ExpressionInformation = VariableInformation & {
    expression: binaryen.ExpressionIds;
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
    stacks: {
        continue: string[];
        break: string[];
        depth: number;
    };
    current_function: {
        results: VariableInformation;
    };
};
