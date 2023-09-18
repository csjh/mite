import binaryen from "binaryen";
import {
    bigintToLowAndHigh,
    coerceBinaryExpression,
    coerceToExpected,
    createTypeOperations,
    lookForVariable
} from "./utils.js";
import type { Context, ExpressionInformation } from "../types/code_gen.js";
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
    BlockExpression,
    DoWhileExpression,
    WhileExpression
} from "../types/nodes.js";
import { TokenType } from "../types/tokens.js";

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
            .map(({ id, params, returnType }) => [
                id.name,
                {
                    name: id.name,
                    params: params.map(({ typeAnnotation }) => ({
                        type: TYPES[typeAnnotation.name],
                        isUnsigned: typeAnnotation.isUnsigned
                    })),
                    results: {
                        type: TYPES[returnType.name],
                        isUnsigned: returnType.isUnsigned
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
                buildFunctionDeclaration(ctx, node);
                break;
        }
    }

    for (const key of ctx.functions.keys()) {
        ctx.mod.addFunctionExport(key, key);
    }

    return ctx.mod;
}

function buildFunctionDeclaration(ctx: Context, node: FunctionDeclaration): void {
    ctx.variables = new Map(
        node.params.map(
            ({ name, typeAnnotation }, index) =>
                [
                    name.name,
                    {
                        index,
                        type: TYPES[typeAnnotation.name],
                        isUnsigned: typeAnnotation.isUnsigned
                    }
                ] as const
        )
    );

    const { params, results } = ctx.functions.get(node.id.name)!;

    const function_body = ctx.mod.block(
        null,
        node.body.body.map(
            (statement) =>
                statementToExpression({ ...ctx, current_function: { results } }, statement).ref
        )
    );

    const function_variables = Array.from(ctx.variables.values()).filter(
        (variable) => variable.index >= node.params.length // get rid of parameter variables
    );

    ctx.mod.addFunction(
        node.id.name,
        binaryen.createType(params.map(({ type }) => type)),
        results.type,
        function_variables.map(({ type }) => type),
        function_body
    );
}

function statementToExpression(ctx: Context, value: Statement): ExpressionInformation {
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
): ExpressionInformation {
    const expressions = [];
    for (const { id, typeAnnotation, init } of value.declarations) {
        const variable = {
            index: ctx.variables.size,
            type: TYPES[typeAnnotation.name],
            isUnsigned: typeAnnotation.isUnsigned
        };

        ctx.variables.set(id.name, variable);

        if (!init) continue;

        const expr = expressionToExpression({ ...ctx, expected: variable }, init);
        const ref = ctx.mod.local.set(variable.index, expr.ref);
        expressions.push(ref);
    }

    return {
        ref: ctx.mod.block(null, expressions),
        type: TYPES.void
    };
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
    } else if (value.type === "DoWhileExpression") {
        expr = doWhileExpressionToExpression(ctx, value);
    } else if (value.type === "WhileExpression") {
        expr = whileExpressionToExpression(ctx, value);
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
        case TokenType.PLUS:
            return ctx.type_operations[type].add(coerced_left, coerced_right);
        case TokenType.MINUS:
            return ctx.type_operations[type].sub(coerced_left, coerced_right);
        case TokenType.STAR:
            return ctx.type_operations[type].mul(coerced_left, coerced_right);
        case TokenType.SLASH:
            return ctx.type_operations[type].div(coerced_left, coerced_right);
        case TokenType.EQUALS:
            return ctx.type_operations[type].eq(coerced_left, coerced_right);
        case TokenType.NOT_EQUALS:
            return ctx.type_operations[type].ne(coerced_left, coerced_right);
        case TokenType.LESS_THAN:
            return ctx.type_operations[type].lt(coerced_left, coerced_right);
        case TokenType.LESS_THAN_EQUALS:
            return ctx.type_operations[type].lte(coerced_left, coerced_right);
        case TokenType.GREATER_THAN:
            return ctx.type_operations[type].gt(coerced_left, coerced_right);
        case TokenType.GREATER_THAN_EQUALS:
            return ctx.type_operations[type].gte(coerced_left, coerced_right);
    }

    if (type === TYPES.i32 || type === TYPES.i64) {
        switch (value.operator) {
            case TokenType.BITSHIFT_LEFT:
                return ctx.type_operations[type].shl!(coerced_left, coerced_right);
            case TokenType.BITSHIFT_RIGHT:
                return ctx.type_operations[type].shr!(coerced_left, coerced_right);
            case TokenType.MODULUS:
                return ctx.type_operations[type].mod!(coerced_left, coerced_right);
            case TokenType.BITWISE_OR:
                return ctx.type_operations[type].or!(coerced_left, coerced_right);
            case TokenType.BITWISE_XOR:
                return ctx.type_operations[type].xor!(coerced_left, coerced_right);
            case TokenType.BITWISE_AND:
                return ctx.type_operations[type].and!(coerced_left, coerced_right);
        }
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
    if (init) forloop.push(init.ref);
    if (test) forloop.push(ctx.mod.br_if("forloop", ctx.mod.i32.eqz(test.ref)));

    const loopbody = [];
    loopbody.push(body.ref);
    if (update) loopbody.push(update.ref);
    if (test) loopbody.push(ctx.mod.br_if("forloopbody", test.ref));

    forloop.push(ctx.mod.loop("forloopbody", ctx.mod.block(null, loopbody)));

    return {
        ...body,
        // todo: add depth to ctx
        ref: ctx.mod.block("forloop", forloop)
    };
}

function doWhileExpressionToExpression(
    ctx: Context,
    value: DoWhileExpression
): ExpressionInformation {
    const body = expressionToExpression(ctx, value.body);
    let test = {
        ref: ctx.mod.i32.const(0),
        type: TYPES.i32
    };
    if (value.test) {
        test = expressionToExpression({ ...ctx, expected: { type: TYPES.i32 } }, value.test);
    }

    return {
        ...body,
        ref: ctx.mod.loop(
            "dowhileloopbody",
            ctx.mod.block(null, [body.ref, ctx.mod.br_if("dowhileloopbody", test.ref)])
        )
    };
}

function whileExpressionToExpression(ctx: Context, value: WhileExpression): ExpressionInformation {
    if (!value.test) return { ref: ctx.mod.nop(), type: TYPES.void };

    const test = expressionToExpression({ ...ctx, expected: { type: TYPES.i32 } }, value.test);
    const body = expressionToExpression(ctx, value.body);

    return {
        ...body,
        ref: ctx.mod.if(
            test.ref,
            ctx.mod.loop(
                "whileloop",
                ctx.mod.block(null, [body.ref, ctx.mod.br_if("whileloop", test.ref)])
            )
        )
    };
}

function blockExpressionToExpression(ctx: Context, value: BlockExpression): ExpressionInformation {
    const return_value = value.body.at(-1);
    let return_type = TYPES.void;
    if (return_value) {
        const { ref } = statementToExpression(ctx, return_value);
        return_type = binaryen.getExpressionType(ref);
        if (!(return_type in TYPES)) {
            throw new Error(`Unknown return type: ${return_type}`);
        }
    }

    return {
        ref: ctx.mod.block(
            null,
            value.body.map((statement) => statementToExpression(ctx, statement).ref),
            return_type
        ),
        type: return_type
    };
}
