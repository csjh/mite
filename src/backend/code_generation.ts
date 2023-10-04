import binaryen from "binaryen";
import {
    bigintToLowAndHigh,
    coerceBinaryExpression,
    coerceToExpected,
    createTypeOperations,
    handleFunctionOperator,
    isFunctionOperator,
    lookForVariable,
    updateExpected
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
    WhileExpression,
    ContinueExpression,
    BreakExpression,
    LogicalExpression,
    EmptyExpression
} from "../types/nodes.js";
import { TokenType } from "../types/tokens.js";

export function programToModule(program: Program): binaryen.Module {
    const mod = new binaryen.Module();
    const ctx: Context = {
        mod,
        variables: new Map(),
        functions: new Map(),
        type_operations: createTypeOperations(mod), // goal of this is easier extensibility
        stacks: { continue: [], break: [], depth: 0 },
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

        const expr = expressionToExpression(updateExpected(ctx, variable), init);
        const ref = ctx.mod.local.set(variable.index, expr.ref);
        expressions.push(ref);
    }

    return {
        ref: ctx.mod.block(null, expressions),
        type: TYPES.void,
        expression: binaryen.ExpressionIds.Block
    };
}

function returnStatementToExpression(ctx: Context, value: ReturnStatement): ExpressionInformation {
    const expr =
        value.argument &&
        expressionToExpression(updateExpected(ctx, ctx.current_function.results), value.argument);
    return {
        ref: ctx.mod.return(expr?.ref),
        type: TYPES.void,
        expression: binaryen.ExpressionIds.Return
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
    } else if (value.type === "LogicalExpression") {
        expr = logicalExpressionToExpression(ctx, value);
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
    } else if (value.type === "EmptyExpression") {
        expr = emptyExpressionToExpression(ctx, value);
    } else if (value.type === "ContinueExpression") {
        expr = continueExpressionToExpression(ctx, value);
    } else if (value.type === "BreakExpression") {
        expr = breakExpressionToExpression(ctx, value);
    } else {
        throw new Error(`Unknown statement type: ${value.type}`);
    }
    return coerceToExpected(ctx, expr);
}

function literalToExpression(ctx: Context, value: Literal): ExpressionInformation {
    const type = ctx.expected?.type ?? value.literalType;
    let ref;
    switch (type as TYPES) {
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
            throw new Error(`Unknown literal type: ${type}`);
    }
    return {
        ref,
        type,
        expression: binaryen.ExpressionIds.Const
    };
}

function identifierToExpression(ctx: Context, value: Identifier): ExpressionInformation {
    const { index, type } = lookForVariable(ctx, value.name);
    const ref = ctx.mod.local.get(index, type);
    return { ref, type, expression: binaryen.ExpressionIds.LocalGet };
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

function logicalExpressionToExpression(
    ctx: Context,
    value: LogicalExpression
): ExpressionInformation {
    const left = expressionToExpression(updateExpected(ctx, { type: TYPES.i32 }), value.left),
        right = expressionToExpression(updateExpected(ctx, { type: TYPES.i32 }), value.right);

    switch (value.operator) {
        case TokenType.LOGICAL_OR:
            return {
                ref: ctx.mod.if(
                    left.ref,
                    ctx.mod.i32.const(1),
                    ctx.mod.i32.ne(right.ref, ctx.mod.i32.const(0))
                ),
                expression: binaryen.ExpressionIds.If,
                type: TYPES.i32
            };
        case TokenType.LOGICAL_AND:
            return {
                ref: ctx.mod.if(
                    ctx.mod.i32.eqz(left.ref),
                    ctx.mod.i32.const(0),
                    ctx.mod.i32.ne(right.ref, ctx.mod.i32.const(0))
                ),
                expression: binaryen.ExpressionIds.If,
                type: TYPES.i32
            };
    }

    throw new Error(`Unknown logical operator: ${value.operator}`);
}

function assignmentExpressionToExpression(
    ctx: Context,
    value: AssignmentExpression
): ExpressionInformation {
    const expr = expressionToExpression(
        updateExpected(ctx, lookForVariable(ctx, value.left.name)),
        value.right
    );
    const variable = lookForVariable(ctx, value.left.name);

    let operation: keyof (typeof ctx.type_operations)[number] | false = false;
    switch (value.operator) {
        case "=":
            break;
        case "+=":
            operation = "add";
            break;
        case "-=":
            operation = "sub";
            break;
        case "*=":
            operation = "mul";
            break;
        case "/=":
            operation = "div";
            break;
        case "%=":
            if (variable.type === TYPES.f32 || variable.type === TYPES.f64)
                throw new Error("Cannot perform modulo on floats");
            operation = "mod";
            break;
        case "<<=":
            if (variable.type === TYPES.f32 || variable.type === TYPES.f64)
                throw new Error("Cannot bit shift floats");
            operation = "shl";
            break;
        case ">>=":
            if (variable.type === TYPES.f32 || variable.type === TYPES.f64)
                throw new Error("Cannot bit shift floats");
            operation = "shr";
            break;
        case "|=":
            if (variable.type === TYPES.f32 || variable.type === TYPES.f64)
                throw new Error("Cannot bitwise or floats");
            operation = "or";
            break;
        case "^=":
            if (variable.type === TYPES.f32 || variable.type === TYPES.f64)
                throw new Error("Cannot xor floats");
            operation = "xor";
            break;
        case "&=":
            if (variable.type === TYPES.f32 || variable.type === TYPES.f64)
                throw new Error("Cannot bitwise and floats");
            operation = "and";
            break;
    }

    const ref = ctx.mod.local.set(
        variable.index,
        !operation
            ? expr.ref
            : ctx.type_operations[expr.type][operation]!(
                  // todo: this shouldn't be done inline
                  {
                      ref: ctx.mod.local.get(variable.index, variable.type),
                      expression: binaryen.ExpressionIds.LocalGet,
                      type: variable.type
                  },
                  expr
              ).ref
    );

    return { ref, type: TYPES.void, expression: binaryen.ExpressionIds.LocalSet };
}

function callExpressionToExpression(ctx: Context, value: CallExpression): ExpressionInformation {
    const fn = ctx.functions.get(value.callee.name);
    const args = value.arguments.map((arg, i) =>
        expressionToExpression(updateExpected(ctx, fn?.params[i]), arg)
    );

    if (isFunctionOperator(value.callee.name)) {
        return handleFunctionOperator(ctx, value.callee.name, args);
    } else if (!fn) throw new Error(`Unknown function: ${value.callee.name}`);

    return {
        ref: ctx.mod.call(
            value.callee.name,
            args.map((arg) => arg.ref),
            fn.results.type
        ),
        type: fn.results.type,
        expression: binaryen.ExpressionIds.Call
    };
}

function ifExpressionToExpression(ctx: Context, value: IfExpression): ExpressionInformation {
    const condition = expressionToExpression(updateExpected(ctx, { type: TYPES.i32 }), value.test);
    const true_branch = expressionToExpression(ctx, value.consequent);
    const false_branch = value.alternate && expressionToExpression(ctx, value.alternate);

    return {
        ref: ctx.mod.if(condition.ref, true_branch.ref, false_branch?.ref),
        type: true_branch.type,
        expression: binaryen.ExpressionIds.If
    };
}

function forExpressionToExpression(ctx: Context, value: ForExpression): ExpressionInformation {
    const for_loop_container_label = `ForLoopOuterContainerBlock$${ctx.stacks.depth}`;
    const for_loop_loop_part_label = `ForLoopBodyTestUpdateLoop$${ctx.stacks.depth}`;
    const for_loop_user_body_label = `ForLoopUserDefinedBody$${ctx.stacks.depth}`;

    // breaks break out of the whole loop
    ctx.stacks.break.push(for_loop_container_label);

    // this is not a mistake; continues need to break out of the main body and re-execute
    // update and test, and main_body only contains the user-defined body
    ctx.stacks.continue.push(for_loop_user_body_label);
    ctx.stacks.depth++;

    const init =
        value.init &&
        (value.init.type === "VariableDeclaration"
            ? variableDeclarationToExpression(ctx, value.init)
            : expressionToExpression(ctx, value.init));

    const test =
        value.test &&
        (value.test.type === "EmptyExpression"
            ? { type: TYPES.i32, ref: ctx.mod.i32.const(1) }
            : expressionToExpression(updateExpected(ctx, { type: TYPES.i32 }), value.test));

    const update = value.update && expressionToExpression(ctx, value.update);
    const body = expressionToExpression(ctx, value.body);

    const for_loop_container = [];
    if (init) for_loop_container.push(init.ref);
    if (test) {
        // if test fails, don't even start the loop
        for_loop_container.push(
            ctx.mod.br_if(
                for_loop_container_label,
                ctx.mod.i32.eqz(ctx.mod.copyExpression(test.ref))
            )
        );
    }

    const for_loop_loop_part = [];

    for_loop_loop_part.push(ctx.mod.block(for_loop_user_body_label, [body.ref]));
    if (update) for_loop_loop_part.push(update.ref);
    if (test) for_loop_loop_part.push(ctx.mod.br_if(for_loop_loop_part_label, test.ref));

    for_loop_container.push(
        ctx.mod.loop(for_loop_loop_part_label, ctx.mod.block(null, for_loop_loop_part))
    );

    const ref = ctx.mod.block(for_loop_container_label, for_loop_container);

    ctx.stacks.break.pop();
    ctx.stacks.continue.pop();

    return { ref, type: TYPES.void, expression: binaryen.ExpressionIds.Block };
}

function doWhileExpressionToExpression(
    ctx: Context,
    value: DoWhileExpression
): ExpressionInformation {
    const do_while_loop_container_block = `DoWhileLoopContainerBlock$${ctx.stacks.depth}`;
    const do_while_loop_body_block = `DoWhileLoopBody$${ctx.stacks.depth}`;
    ctx.stacks.break.push(do_while_loop_container_block);
    ctx.stacks.continue.push(do_while_loop_body_block);
    ctx.stacks.depth++;

    const body = expressionToExpression(ctx, value.body);
    const test = value.test
        ? expressionToExpression(updateExpected(ctx, { type: TYPES.i32 }), value.test)
        : {
              ref: ctx.mod.i32.const(0),
              type: TYPES.i32
          };

    const ref = ctx.mod.loop(
        do_while_loop_body_block,
        ctx.mod.block(do_while_loop_container_block, [
            body.ref,
            ctx.mod.br_if(do_while_loop_body_block, test.ref)
        ])
    );

    ctx.stacks.break.pop();
    ctx.stacks.continue.pop();

    return { ref, type: TYPES.void, expression: binaryen.ExpressionIds.Loop };
}

function whileExpressionToExpression(ctx: Context, value: WhileExpression): ExpressionInformation {
    const while_loop_container_block = `WhileLoopContainerBlock$${ctx.stacks.depth}`;
    const while_loop_body_block = `WhileLoopBody$${ctx.stacks.depth}`;
    ctx.stacks.break.push(while_loop_container_block);
    ctx.stacks.continue.push(while_loop_body_block);
    ctx.stacks.depth++;

    const test = expressionToExpression(updateExpected(ctx, { type: TYPES.i32 }), value.test);
    const body = expressionToExpression(ctx, value.body);

    const ref = ctx.mod.if(
        test.ref, // if test.ref tries to continue or break it might be weird
        ctx.mod.block(while_loop_container_block, [
            ctx.mod.loop(
                while_loop_body_block,
                ctx.mod.block(null, [
                    body.ref,
                    ctx.mod.br_if(while_loop_body_block, ctx.mod.copyExpression(test.ref))
                ])
            )
        ])
    );

    ctx.stacks.break.pop();
    ctx.stacks.continue.pop();

    return {
        ref,
        type: TYPES.void,
        expression: binaryen.ExpressionIds.If
    };
}

function blockExpressionToExpression(ctx: Context, value: BlockExpression): ExpressionInformation {
    // note: currently can't break out of blocks
    const block = `Block$${ctx.stacks.depth}`;
    ctx.stacks.depth++;

    const ref = ctx.mod.block(
        block,
        value.body.map((statement) => statementToExpression(ctx, statement).ref),
        binaryen.auto
    );
    const type = binaryen.getExpressionType(ref);

    return { ref, type, expression: binaryen.ExpressionIds.Block };
}

function continueExpressionToExpression(
    ctx: Context,
    value: ContinueExpression
): ExpressionInformation {
    const loop = ctx.stacks.continue.at(-1);
    if (!loop) throw new Error("Cannot continue outside of loop");
    return {
        ref: ctx.mod.br(loop),
        type: TYPES.void,
        expression: binaryen.ExpressionIds.Break
    };
}

// todo: support labeled breaks;
function breakExpressionToExpression(ctx: Context, value: BreakExpression): ExpressionInformation {
    const block = ctx.stacks.break.at(-1);
    if (!block) throw new Error("Cannot break outside of a block");
    return {
        ref: ctx.mod.br(block),
        type: TYPES.void,
        expression: binaryen.ExpressionIds.Break
    };
}

function emptyExpressionToExpression(ctx: Context, value: EmptyExpression): ExpressionInformation {
    return { ref: ctx.mod.nop(), type: TYPES.void, expression: binaryen.ExpressionIds.Nop };
}
