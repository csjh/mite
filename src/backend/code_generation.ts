import binaryen from "binaryen";
import { bigintToLowAndHigh, createTypeOperations } from "./utils.js";
import type { Context, ExpressionInformation } from "../types/code_gen.js";
import { types } from "../types/code_gen.js";
import type { Program, Statement, Expression, BinaryExpression } from "../types/nodes.js";

export function program_to_module(program: Program): binaryen.Module {
    const mod = new binaryen.Module();
    const ctx: Context = {
        mod,
        variables: new Map(),
        functions: new Map(),
        type_operations: createTypeOperations(mod), // goal of this is easier extensibility
        // @ts-expect-error initially we're not in a function
        current_function: null
    };

    for (const node of program.body) {
        switch (node.type) {
            case "FunctionDeclaration":
                // only has top-level variables
                // todo: implement nested variables
                // probably just a recursive check thru fields w/ 'type' and fat switch
                const function_variables = node.body.body.filter(
                    (node) => node.type === "VariableDeclaration"
                ) as Extract<Statement, { type: "VariableDeclaration" }>[];

                const weird_type = function_variables
                    .find((variable) =>
                        variable.declarations.some(
                            (declaration) => !(declaration.typeAnnotation.name in types)
                        )
                    )
                    ?.declarations.find(
                        (declaration) => !(declaration.typeAnnotation.name in types)
                    );

                if (weird_type) {
                    throw new Error(
                        `Unknown type found: ${weird_type.id.name} is of type ${weird_type.typeAnnotation.name}`
                    );
                }

                let var_index = 0;
                ctx.variables = new Map(
                    function_variables
                        .flatMap((variable) => variable.declarations)
                        .map(
                            (declaration) =>
                                [
                                    declaration.id.name,
                                    {
                                        index: var_index++,
                                        type: declaration.typeAnnotation.name,
                                        binaryenType: types[declaration.typeAnnotation.name],
                                        isUnsigned: declaration.typeAnnotation.isUnsigned
                                    }
                                ] as const
                        )
                );

                const results = {
                    type: node.returnType.name,
                    binaryenType: types[node.returnType.name],
                    isUnsigned: node.returnType.isUnsigned
                };

                const fn = ctx.mod.addFunction(
                    node.id.name,
                    binaryen.createType(
                        node.params.map((param) => types[param.typeAnnotation.name])
                    ),
                    results.binaryenType,
                    // lol 3 copies of array
                    function_variables
                        .flatMap((variable) => variable.declarations)
                        .map((declaration) => types[declaration.typeAnnotation.name]),
                    ctx.mod.block(
                        null,
                        node.body.body
                            .flatMap((statement) =>
                                statement_to_expression(
                                    {
                                        ...ctx,
                                        current_function: {
                                            results
                                        }
                                    },
                                    statement
                                )
                            )
                            .map((x) => x.ref)
                    )
                );

                ctx.functions.set(node.id.name, { ref: fn });
                break;
        }
    }

    for (const key of ctx.functions.keys()) {
        ctx.mod.addFunctionExport(key, key);
    }

    return ctx.mod;
}

function statement_to_expression(
    ctx: Context,
    value: Statement
): ExpressionInformation | ExpressionInformation[] {
    switch (value.type) {
        case "VariableDeclaration":
            return value.declarations
                .filter((declaration) => declaration.init)
                .map((declaration) => {
                    const expr = expression_to_expression(
                        { ...ctx, expected: ctx.variables.get(declaration.id.name) },
                        declaration.init!
                    );
                    const ref = ctx.mod.local.set(
                        ctx.variables.get(declaration.id.name)!.index,
                        expr.ref
                    );
                    return {
                        ref,
                        type: "void",
                        binaryenType: binaryen.none
                    };
                });
        case "ReturnStatement":
            if (!value.argument) {
                return {
                    ref: ctx.mod.return(),
                    type: "void",
                    binaryenType: binaryen.none
                };
            }
            const expr = expression_to_expression(
                { ...ctx, expected: ctx.current_function.results },
                value.argument
            );
            return {
                ...expr,
                ref: ctx.mod.return(expr.ref)
            };
        case "ExpressionStatement":
            return expression_to_expression(ctx, value.expression);
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function expression_to_expression(ctx: Context, value: Expression): ExpressionInformation {
    if (value.type === "Literal") {
        if (!ctx.expected) {
            const type = typeof value.value === "bigint" ? "i64" : "f64";
            return {
                ref:
                    typeof value.value === "bigint"
                        ? ctx.mod.i64.const(...bigintToLowAndHigh(value.value))
                        : ctx.mod.f64.const(value.value),
                type,
                binaryenType: binaryen[type]
            };
        }
        let ref;
        switch (ctx.expected.type) {
            case "i32":
                ref = ctx.mod.i32.const(Number(value.value));
                break;
            case "i64":
                ref = ctx.mod.i64.const(...bigintToLowAndHigh(value.value));
                break;
            case "f32":
                ref = ctx.mod.f32.const(Number(value.value));
                break;
            case "f64":
                ref = ctx.mod.f64.const(Number(value.value));
                break;
            default:
                throw new Error(`Unknown literal type: ${ctx.expected.type}`);
        }
        return {
            ...ctx.expected,
            ref
        };
    } else if (value.type === "Identifier") {
        const { index, binaryenType, type } = ctx.variables.get(value.name)!;
        const ref = ctx.mod.local.get(index, binaryenType);
        return {
            ref,
            binaryenType,
            type
        };
    } else if (value.type === "BinaryExpression") {
        const [coerced_left, coerced_right] = coerceBinaryExpression(ctx, value);
        const type = coerced_left.type;

        switch (value.operator) {
            case "+":
                return ctx.type_operations[type].add(coerced_left, coerced_right);
            case "-":
                return ctx.type_operations[type].sub(coerced_left, coerced_right);
            case "*":
                return ctx.type_operations[type].mul(coerced_left, coerced_right);
            case "/":
                return ctx.type_operations[type].div(coerced_left, coerced_right);
            default:
                throw new Error(`Unknown binary operator: ${value.operator}`);
        }
    } else if (value.type === "AssignmentExpression") {
        const expr = expression_to_expression(
            { ...ctx, expected: ctx.variables.get(value.left.name) },
            value.right
        );

        const ref = ctx.mod.local.set(ctx.variables.get(value.left.name)!.index, expr.ref);
        return {
            ref,
            binaryenType: binaryen.none,
            type: "void"
        };
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function coerceBinaryExpression(
    ctx: Context,
    value: BinaryExpression
): [ExpressionInformation, ExpressionInformation] {
    const { expected } = ctx,
        { left, right } = value;
    if (expected)
        return [
            ctx.type_operations[expected.type].coerce(expression_to_expression(ctx, left), ctx),
            ctx.type_operations[expected.type].coerce(expression_to_expression(ctx, right), ctx)
        ];

    const left_expr = expression_to_expression(ctx, left),
        right_expr = expression_to_expression(ctx, right);

    if (left_expr.binaryenType === right_expr.binaryenType) return [left_expr, right_expr];
    for (const type of [binaryen.f64, binaryen.f32, binaryen.i64, binaryen.i32]) {
        if (left_expr.binaryenType === type)
            return [left_expr, ctx.type_operations[left_expr.type].coerce(right_expr, ctx)];
        if (right_expr.binaryenType === type)
            return [ctx.type_operations[right_expr.type].coerce(left_expr, ctx), right_expr];
    }

    throw new Error(`Unknown coercion: ${left_expr.type} to ${right_expr.type}`);
}
