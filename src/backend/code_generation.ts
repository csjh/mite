import binaryen from "binaryen";
import { bigintToLowAndHigh } from "./utils.js";
import type { Context } from "../types/code_gen.js";
import { types } from "../types/code_gen.js";
import type {
    Program,
    VariableDeclaration,
    Statement,
    Expression,
    BinaryExpression
} from "../types/nodes.js";

export function program_to_module(program: Program): binaryen.Module {
    const ctx: Context = {
        mod: new binaryen.Module(),
        variables: new Map(),
        functions: new Map(),
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
                ) as VariableDeclaration[];

                if (
                    !function_variables.every((variable) =>
                        variable.declarations.every((declaration) =>
                            types.has(declaration.typeAnnotation.name)
                        )
                    )
                ) {
                    const weird_decl = function_variables.find((variable) =>
                        variable.declarations.some(
                            (declaration) => !types.has(declaration.typeAnnotation.name)
                        )
                    );
                    const weird_type = weird_decl?.declarations.find(
                        (declaration) => !types.has(declaration.typeAnnotation.name)
                    )!;

                    throw new Error(
                        `Unknown type found: ${weird_type.id.name} is of type ${weird_type.typeAnnotation.name}`
                    );
                }

                let var_index = 0;
                ctx.variables = new Map(
                    function_variables
                        .map((variable) =>
                            variable.declarations.map(
                                (declaration) =>
                                    [
                                        declaration.id.name,
                                        {
                                            index: var_index++,
                                            type: declaration.typeAnnotation.name as
                                                | "i32"
                                                | "i64"
                                                | "f32"
                                                | "f64",
                                            binaryenType: types.get(
                                                declaration.typeAnnotation.name
                                            )!
                                        }
                                    ] as const
                            )
                        )
                        .flat(1)
                );

                const fn = ctx.mod.addFunction(
                    node.id.name,
                    binaryen.createType(
                        node.params.map((param) => types.get(param.typeAnnotation.name)!)
                    ),
                    types.get(node.returnType.name)!,
                    function_variables.flatMap((variable) =>
                        variable.declarations.map(
                            (declaration) => types.get(declaration.typeAnnotation.name)!
                        )
                    ),
                    ctx.mod.block(
                        null,
                        node.body.body.flatMap((statement) =>
                            statement_to_expression(ctx, statement)
                        )
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
): binaryen.ExpressionRef | binaryen.ExpressionRef[] {
    switch (value.type) {
        case "VariableDeclaration":
            return value.declarations.map((declaration) =>
                ctx.mod.local.set(
                    ctx.variables.get(declaration.id.name)!.index,
                    expression_to_expression(
                        { ...ctx, expected: ctx.variables.get(declaration.id.name) },
                        declaration.init!
                    )
                )
            );
        case "ReturnStatement":
            return ctx.mod.return(
                coerceTypeOf(ctx, expression_to_expression(ctx, value.argument!), binaryen.f32)
            );
        case "ExpressionStatement":
            return expression_to_expression(ctx, value.expression!);
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function expression_to_expression(ctx: Context, value: Expression): binaryen.ExpressionRef {
    switch (value.type) {
        case "Literal":
            if (!ctx.expected)
                return typeof value.value === "bigint"
                    ? ctx.mod.i64.const(...bigintToLowAndHigh(value.value))
                    : ctx.mod.f64.const(value.value as number);
            switch (ctx.expected.type) {
                case "i32":
                    return ctx.mod.i32.const(value.value as number);
                case "i64":
                    return ctx.mod.i64.const(...bigintToLowAndHigh(value.value as bigint));
                case "f32":
                    return ctx.mod.f32.const(value.value as number);
                case "f64":
                    return ctx.mod.f64.const(value.value as number);
                default:
                    throw new Error(`Unknown type: ${ctx.expected.type}`);
            }
        case "Identifier":
            const { index, binaryenType } = ctx.variables.get(value.name)!;
            return ctx.mod.local.get(index, binaryenType);
        case "BinaryExpression":
            const [coerced_left, coerced_right] = coerceBinaryExpression(ctx, value);
            const expected = ctx.expected ?? {
                type:
                    binaryen.getExpressionType(coerced_left) === binaryen.i64
                        ? "i64"
                        : binaryen.getExpressionType(coerced_left) === binaryen.i32
                        ? "i32"
                        : binaryen.getExpressionType(coerced_left) === binaryen.f32
                        ? "f32"
                        : "f64"
            };

            switch (value.operator) {
                case "+":
                    return ctx.mod[expected.type].add(coerced_left, coerced_right);
                case "-":
                    return ctx.mod[expected.type].sub(coerced_left, coerced_right);
                case "*":
                    return ctx.mod[expected.type].mul(coerced_left, coerced_right);
                case "/":
                    if (expected.type === "i64" || expected.type === "i32") {
                        // todo: implement unsigned/signed)
                        return ctx.mod[expected.type].div_s(coerced_left, coerced_right);
                    } else {
                        return ctx.mod[expected.type].div(coerced_left, coerced_right);
                    }
                default:
                    throw new Error(`Unknown binary operator: ${value.operator}`);
            }
        case "AssignmentExpression":
            return ctx.mod.local.set(
                ctx.variables.get(value.left.name)!.index,
                expression_to_expression(ctx, value.right)
            );
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function coerceBinaryExpression(
    ctx: Context,
    value: BinaryExpression
): [binaryen.ExpressionRef, binaryen.ExpressionRef] {
    const { expected } = ctx,
        { left, right } = value;
    if (expected)
        return [
            coerceTypeOf(ctx, expression_to_expression(ctx, left), expected.binaryenType),
            coerceTypeOf(ctx, expression_to_expression(ctx, right), expected.binaryenType)
        ];

    const left_expr = expression_to_expression(ctx, left),
        right_expr = expression_to_expression(ctx, right),
        left_type = binaryen.getExpressionType(left_expr),
        right_type = binaryen.getExpressionType(right_expr);

    if (left_type === right_type) return [left_expr, right_expr];
    if (left_type === binaryen.f64) return [left_expr, coerceTypeOf(ctx, left_expr, binaryen.i64)];
    if (right_type === binaryen.f64)
        return [coerceTypeOf(ctx, left_expr, binaryen.i64), right_expr];
    if (left_type === binaryen.f32) return [left_expr, coerceTypeOf(ctx, left_expr, binaryen.i32)];
    if (right_type === binaryen.f32)
        return [coerceTypeOf(ctx, left_expr, binaryen.i32), right_expr];
    if (left_type === binaryen.i64) return [left_expr, coerceTypeOf(ctx, left_expr, binaryen.i32)];
    if (right_type === binaryen.i64)
        return [coerceTypeOf(ctx, left_expr, binaryen.i32), right_expr];
    if (left_type === binaryen.i32) return [left_expr, coerceTypeOf(ctx, left_expr, binaryen.f32)];
    if (right_type === binaryen.i32)
        return [coerceTypeOf(ctx, left_expr, binaryen.f32), right_expr];

    throw new Error(`Unknown coercion: ${left_type} and ${right_type}`);
}

function coerceTypeOf(
    ctx: Context,
    expression: binaryen.ExpressionRef,
    to: binaryen.Type
): binaryen.ExpressionRef {
    const type = binaryen.getExpressionType(expression);
    if (to === binaryen.i32) {
        if (type === binaryen.i32) {
            return expression;
        } else if (type === binaryen.i64) {
            return ctx.mod.i32.wrap(expression);
        } else if (type === binaryen.f32) {
            return ctx.mod.i32.trunc_u.f32(expression);
        } else if (type === binaryen.f64) {
            return ctx.mod.i32.trunc_u.f64(expression);
        } else {
            throw new Error(`Unknown coercion: ${type} to ${to}`);
        }
    } else if (to === binaryen.i64) {
        if (type === binaryen.i32) {
            return ctx.mod.i64.extend_u(expression);
        } else if (type === binaryen.i64) {
            return expression;
        } else if (type === binaryen.f32) {
            return ctx.mod.i64.trunc_u.f32(expression);
        } else if (type === binaryen.f64) {
            return ctx.mod.i64.trunc_u.f64(expression);
        } else {
            throw new Error(`Unknown coercion: ${type} to ${to}`);
        }
    } else if (to === binaryen.f32) {
        if (type === binaryen.i32) {
            return ctx.mod.f32.convert_u.i32(expression);
        } else if (type === binaryen.i64) {
            return ctx.mod.f32.convert_u.i64(expression);
        } else if (type === binaryen.f32) {
            return expression;
        } else if (type === binaryen.f64) {
            return ctx.mod.f32.demote(expression);
        } else {
            throw new Error(`Unknown coercion: ${type} to ${to}`);
        }
    } else if (to === binaryen.f64) {
        if (type === binaryen.i32) {
            return ctx.mod.f64.convert_u.i32(expression);
        } else if (type === binaryen.i64) {
            return ctx.mod.f64.convert_u.i64(expression);
        } else if (type === binaryen.f32) {
            return ctx.mod.f64.promote(expression);
        } else if (type === binaryen.f64) {
            return expression;
        } else {
            throw new Error(`Unknown coercion: ${type} to ${to}`);
        }
    } else {
        throw new Error(`Unknown coercion: ${type} to ${to}`);
    }
}
