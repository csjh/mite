import binaryen from "binaryen";
import {
    bigintToLowAndHigh,
    coerceBinaryExpression,
    coerceToExpected,
    createTypeOperations,
    lookForVariable
} from "./utils.js";
import type {
    Context,
    ExpressionInformation,
    LocalVariableInformation
} from "../types/code_gen.js";
import { TYPES } from "../types/code_gen.js";
import type {
    Program,
    Statement,
    Expression,
    BinaryExpression,
    VariableDeclaration,
    TypedParameter,
    FunctionDeclaration,
    ReturnStatement,
    Literal,
    AssignmentExpression,
    Identifier,
    CallExpression,
    IfExpression,
    ForExpression,
    BlockExpression
} from "../types/nodes.js";

export function programToModule(program: Program): binaryen.Module {
    const mod = new binaryen.Module();
    const ctx: Context = {
        mod,
        variables: new Map(),
        functions: new Map(),
        type_operations: createTypeOperations(mod), // goal of this is easier extensibility
        // @ts-expect-error initially we're not in a function
        current_function: null
    };

    ctx.functions = new Map(
        program.body
            .filter((x): x is FunctionDeclaration => x.type === "FunctionDeclaration")
            .map((node) => [
                node.id.name,
                {
                    name: node.id.name,
                    params: node.params.map((param) => ({
                        type: TYPES[param.typeAnnotation.name],
                        isUnsigned: param.typeAnnotation.isUnsigned
                    })),
                    results: {
                        type: TYPES[node.returnType.name],
                        isUnsigned: node.returnType.isUnsigned
                    }
                }
            ])
    );

    for (const type of ["i32", "i64", "f32", "f64"] as const) {
        ctx.functions.set(`log_${type}`, {
            params: [{ type: TYPES[type], isUnsigned: false }],
            results: { type: TYPES.void, isUnsigned: false }
        });
    }

    for (const node of program.body) {
        switch (node.type) {
            case "FunctionDeclaration":
                // only has top-level variables
                // todo: implement nested variables
                // probably just a recursive check thru fields w/ 'type' and fat switch
                const parameter_vars = node.params;
                const declared_vars = node.body.body
                    .filter<VariableDeclaration>(
                        (node): node is VariableDeclaration => node.type === "VariableDeclaration"
                    )
                    .flatMap((variable) => variable.declarations)
                    .map(
                        (variable) =>
                            ({
                                type: "TypedParameter",
                                name: variable.id,
                                typeAnnotation: variable.typeAnnotation
                            }) as TypedParameter
                    );

                const function_variables = [...parameter_vars, ...declared_vars];

                const weird_type = function_variables.find(
                    (variable) => !(variable.typeAnnotation.name in TYPES)
                );

                if (weird_type) {
                    throw new Error(
                        `Unknown type found: ${weird_type.name.name} is of type ${weird_type.typeAnnotation.name}`
                    );
                }

                let var_index = 0;
                ctx.variables = new Map(
                    function_variables.map(
                        ({ name, typeAnnotation }) =>
                            [
                                name.name,
                                {
                                    index: var_index++,
                                    type: TYPES[typeAnnotation.name],
                                    isUnsigned: typeAnnotation.isUnsigned
                                }
                            ] as const
                    )
                );

                const { params, results } = ctx.functions.get(node.id.name)!;

                ctx.mod.addFunction(
                    node.id.name,
                    binaryen.createType(params.map((param) => param.type)),
                    results.type,
                    function_variables.map((declaration) => TYPES[declaration.typeAnnotation.name]),
                    ctx.mod.block(
                        null,
                        node.body.body
                            .flatMap((statement) =>
                                statementToExpression(
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

                break;
        }
    }

    for (const key of ctx.functions.keys()) {
        ctx.mod.addFunctionExport(key, key);
    }

    return ctx.mod;
}

function statementToExpression(
    ctx: Context,
    value: Statement
): ExpressionInformation | ExpressionInformation[] {
    switch (value.type) {
        case "VariableDeclaration":
            return variableDeclarationToExpression(ctx, value);
        case "ReturnStatement":
            return returnStatementToExpression(ctx, value);
        case "ExpressionStatement":
            return expressionToExpression(ctx, value.expression);
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function variableDeclarationToExpression(
    ctx: Context,
    value: VariableDeclaration
): ExpressionInformation[] {
    const withInitializers = value.declarations.filter((declaration) => declaration.init);

    const expressions: ExpressionInformation[] = [];
    for (const declaration of withInitializers) {
        const expr = expressionToExpression(
            { ...ctx, expected: lookForVariable(ctx, declaration.id.name) },
            declaration.init!
        );
        const ref = ctx.mod.local.set(lookForVariable(ctx, declaration.id.name).index, expr.ref);
        expressions.push({
            ref,
            type: TYPES.void
        });
    }
    return expressions;
}

function returnStatementToExpression(ctx: Context, value: ReturnStatement): ExpressionInformation {
    if (!value.argument) {
        return {
            ref: ctx.mod.return(),
            type: TYPES.void
        };
    }
    const expr = expressionToExpression(
        { ...ctx, expected: ctx.current_function.results },
        value.argument
    );
    return {
        ...expr,
        ref: ctx.mod.return(expr.ref)
    };
}

function expressionToExpression(ctx: Context, value: Expression): ExpressionInformation {
    let expr: ExpressionInformation;
    if (value.type === "Literal") {
        expr = literalToExpression(ctx, value);
    } else if (value.type === "Identifier") {
        expr = identifierToExpression(ctx, value);
    } else if (value.type === "BinaryExpression") {
        expr = binaryExpressionToExpression(ctx, value);
    } else if (value.type === "AssignmentExpression") {
        expr = assignmentExpressionToExpression(ctx, value);
    } else if (value.type === "CallExpression") {
        expr = callExpressionToExpression(ctx, value);
    } else if (value.type === "IfExpression") {
        expr = ifExpressionToExpression(ctx, value);
    } else if (value.type === "ForExpression") {
        expr = forExpressionToExpression(ctx, value);
    } else if (value.type === "BlockExpression") {
        expr = blockExpressionToExpression(ctx, value);
    } else {
        throw new Error(`Unknown statement type: ${value.type}`);
    }
    return coerceToExpected(ctx, expr);
}

function literalToExpression(ctx: Context, value: Literal): ExpressionInformation {
    if (!ctx.expected) {
        const type = typeof value.value === "bigint" ? "i64" : "f64";
        return {
            ref:
                typeof value.value === "bigint"
                    ? ctx.mod.i64.const(...bigintToLowAndHigh(value.value))
                    : ctx.mod.f64.const(value.value),
            type: TYPES[type]
        };
    }
    let ref;
    switch (ctx.expected.type) {
        case TYPES.i32:
            ref = ctx.mod.i32.const(Number(value.value));
            break;
        case TYPES.i64:
            ref = ctx.mod.i64.const(...bigintToLowAndHigh(value.value));
            break;
        case TYPES.f32:
            ref = ctx.mod.f32.const(Number(value.value));
            break;
        case TYPES.f64:
            ref = ctx.mod.f64.const(Number(value.value));
            break;
        default:
            throw new Error(`Unknown literal type: ${ctx.expected.type}`);
    }
    return { ...ctx.expected, ref };
}

function identifierToExpression(ctx: Context, value: Identifier): ExpressionInformation {
    const { index, type } = lookForVariable(ctx, value.name);
    const ref = ctx.mod.local.get(index, type);
    return { ref, type };
}

function binaryExpressionToExpression(
    ctx: Context,
    value: BinaryExpression
): ExpressionInformation {
    const args: [ExpressionInformation, ExpressionInformation] = [
        expressionToExpression(ctx, value.left),
        expressionToExpression(ctx, value.right)
    ];
    const [coerced_left, coerced_right] = coerceBinaryExpression(ctx, args);
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
        case "<":
            return ctx.type_operations[type].lt(coerced_left, coerced_right);
    }

    throw new Error(`Unknown binary operator: ${value.operator}`);
}

function assignmentExpressionToExpression(
    ctx: Context,
    value: AssignmentExpression
): ExpressionInformation {
    const expr = expressionToExpression(
        { ...ctx, expected: lookForVariable(ctx, value.left.name) },
        value.right
    );

    const ref = ctx.mod.local.set(lookForVariable(ctx, value.left.name).index, expr.ref);
    return { ref, type: TYPES.void };
}

function callExpressionToExpression(ctx: Context, value: CallExpression): ExpressionInformation {
    const fn = ctx.functions.get(value.callee.name)!;
    const args = value.arguments.map((arg, i) =>
        expressionToExpression({ ...ctx, expected: fn.params[i] }, arg)
    );

    return {
        ...fn.results,
        ref: ctx.mod.call(
            value.callee.name,
            args.map((arg) => arg.ref),
            fn.results.type
        )
    };
}

function ifExpressionToExpression(ctx: Context, value: IfExpression): ExpressionInformation {
    const condition = expressionToExpression(
        {
            ...ctx,
            expected: {
                type: TYPES.i32
            }
        },
        value.test
    );
    const true_branch = expressionToExpression(ctx, value.consequent);
    const false_branch = value.alternate ? expressionToExpression(ctx, value.alternate) : undefined;

    return {
        ...true_branch,
        ref: ctx.mod.if(condition.ref, true_branch.ref, false_branch?.ref)
    };
}

function forExpressionToExpression(ctx: Context, value: ForExpression): ExpressionInformation {
    const init = value.init
        ? value.init.type === "VariableDeclaration"
            ? variableDeclarationToExpression(ctx, value.init)
            : expressionToExpression(ctx, value.init)
        : undefined;

    const test = value.test
        ? expressionToExpression(
              {
                  ...ctx,
                  expected: {
                      type: TYPES.i32
                  }
              },
              value.test
          )
        : undefined;

    const update = value.update ? expressionToExpression(ctx, value.update) : undefined;
    const body = expressionToExpression(ctx, value.body);

    const forloop = [];
    if (init) {
        const init_as_arr = Array.isArray(init) ? init : [init];
        forloop.push(
            ctx.mod.block(
                null,
                init_as_arr.map((x) => x.ref)
            )
        );
    }
    if (test) forloop.push(ctx.mod.br_if("forloop", ctx.mod.i32.eqz(test.ref)));

    const loopbody = [];
    loopbody.push(body.ref);
    if (update) loopbody.push(update.ref);
    if (test) loopbody.push(ctx.mod.br_if("loopbody", test.ref));

    forloop.push(ctx.mod.loop("loopbody", ctx.mod.block(null, loopbody)));

    return {
        ...body,
        // todo: add depth to ctx
        ref: ctx.mod.block("forloop", forloop)
    };
}

function blockExpressionToExpression(ctx: Context, value: BlockExpression): ExpressionInformation {
    const return_value = value.body.at(-1);
    let return_type = TYPES.void;
    if (return_value) {
        const return_expr = statementToExpression(ctx, return_value);
        if (!Array.isArray(return_expr)) {
            return_type = binaryen.getExpressionType(return_expr.ref);
            if (!(return_type in TYPES)) {
                throw new Error(`Unknown return type: ${return_type}`);
            }
        }
    }

    return {
        ref: ctx.mod.block(
            null,
            value.body
                .map((statement) => statementToExpression(ctx, statement))
                .flat()
                .map((x) => x.ref),
            return_type
        ),
        type: return_type
    };
}
