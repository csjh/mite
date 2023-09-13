import binaryen from "binaryen";
import type { Program, VariableDeclaration, Statement, Expression } from "../types/nodes.js";

export function program_to_module(program: Program): binaryen.Module {
    const mod = new binaryen.Module();

    const functions = new Map<string, binaryen.FunctionRef>();
    const types = new Map([
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
    ]);

    for (const node of program.body) {
        switch (node.type) {
            case "FunctionDeclaration":
                const variables = node.body.body.filter(
                    (node) => node.type === "VariableDeclaration"
                ) as VariableDeclaration[];

                const variable_indexes = new Map(
                    variables.map((variable, index) => [variable.declarations[0].id.name, index])
                );

                const fn = mod.addFunction(
                    node.id.name,
                    binaryen.createType(
                        node.params.map((param) => types.get(param.typeAnnotation.name)!)
                    ),
                    types.get(node.returnType.name)!,
                    variables.map(
                        (variable) => types.get(variable.declarations[0].typeAnnotation.name)!
                    ),
                    mod.block(
                        null,
                        node.body.body.map((statement) =>
                            statement_to_expression(mod, variable_indexes, statement)
                        )
                    )
                );

                functions.set(node.id.name, fn);
                break;
        }
    }

    for (const key of functions.keys()) {
        mod.addFunctionExport(key, key);
    }

    return mod;
}
function statement_to_expression(
    mod: binaryen.Module,
    variable_indexes: Map<string, number>,
    value: Statement
): binaryen.ExpressionRef {
    switch (value.type) {
        case "VariableDeclaration":
            const declaration = value.declarations[0];
            return mod.local.set(
                variable_indexes.get(declaration.id.name)!,
                expression_to_expression(mod, variable_indexes, declaration.init!)
            );
        case "ReturnStatement":
            return mod.return(expression_to_expression(mod, variable_indexes, value.argument!));
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function expression_to_expression(
    mod: binaryen.Module,
    variable_indexes: Map<string, number>,
    value: Expression
): binaryen.ExpressionRef {
    switch (value.type) {
        case "Literal":
            return mod.i32.const(Number(value.value));
        case "Identifier":
            return mod.local.get(variable_indexes.get(value.name!)!, binaryen.i32);
        case "BinaryExpression":
            switch (value.operator) {
                case "+":
                    return mod.i32.add(
                        expression_to_expression(mod, variable_indexes, value.left),
                        expression_to_expression(mod, variable_indexes, value.right)
                    );
                case "-":
                    return mod.i32.sub(
                        expression_to_expression(mod, variable_indexes, value.left),
                        expression_to_expression(mod, variable_indexes, value.right)
                    );
            }
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}
