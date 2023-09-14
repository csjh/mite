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
        case "ExpressionStatement":
            return expression_to_expression(mod, variable_indexes, value.expression!);
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
                case "*":
                    return mod.i32.mul(
                        expression_to_expression(mod, variable_indexes, value.left),
                        expression_to_expression(mod, variable_indexes, value.right)
                    );
                case "/":
                    // todo: implement unsigned/signed
                    return mod.i32.div_s(
                        expression_to_expression(mod, variable_indexes, value.left),
                        expression_to_expression(mod, variable_indexes, value.right)
                    );
                default:
                    throw new Error(`Unknown binary operator: ${value.operator}`);
            }
        case "AssignmentExpression":
            return mod.local.set(
                variable_indexes.get(value.left.name!)!,
                expression_to_expression(mod, variable_indexes, value.right)
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
