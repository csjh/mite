import binaryen from "binaryen";
import {
    bigintToLowAndHigh,
    lookForVariable,
    miteSignatureToBinaryenSignature,
    updateExpected,
    newBlock,
    parseType,
    allocate,
    ARENA_HEAP_OFFSET,
    ARENA_HEAP_POINTER,
    fromExpressionRef,
    createMiteType,
    constructArray,
    VIRTUALIZED_FUNCTIONS
} from "./utils.js";
import {
    Context,
    InstanceFunctionInformation,
    InstancePrimitiveTypeInformation,
    InstanceStructTypeInformation,
    InstanceTypeInformation,
    ProgramToModuleOptions,
    intrinsic_names
} from "../types/code_gen.js";
import type {
    Program,
    Statement,
    Expression,
    BinaryExpression,
    VariableDeclaration,
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
    EmptyExpression,
    MemberExpression,
    Declaration,
    ArrayExpression,
    IndexExpression,
    ObjectExpression
} from "../types/nodes.js";
import { BinaryOperator, TokenType } from "../types/tokens.js";
import {
    Array_,
    DirectFunction,
    IndirectFunction,
    LocalPrimitive,
    MiteType,
    Pointer,
    Primitive,
    Struct,
    StructMethod,
    TransientPrimitive
} from "./type_classes.js";
import { createConversions, createIntrinsics, identifyStructs } from "./context_initialization.js";
import { addBuiltins } from "./builtin_functions.js";

export function programToModule(
    program: Program,
    { stack_size = 64 * 1024 }: ProgramToModuleOptions = {}
): binaryen.Module {
    const structs = Object.fromEntries(identifyStructs(program).map((x) => [x.name, x]));
    const primitives = Object.fromEntries(Primitive.primitives.entries());

    const mod = new binaryen.Module();
    const ctx: Context = {
        mod,
        variables: new Map(),
        stacks: { continue: [], break: [], depth: 0 },
        types: { ...primitives, ...structs } as Context["types"],
        current_block: [],
        captured_functions: [],
        local_count: 0,
        // @ts-expect-error initially we're not in a function
        current_function: null
    };
    ctx.intrinsics = createIntrinsics(ctx);
    ctx.conversions = createConversions(ctx);
    addBuiltins(ctx);

    const js_heap_size = 65536;

    ctx.mod.setMemory(256, -1, "$memory", [], false, false, "main_memory");
    ctx.mod.addGlobal(ARENA_HEAP_OFFSET, binaryen.i32, true, ctx.mod.i32.const(0));
    ctx.mod.addGlobal(
        ARENA_HEAP_POINTER,
        binaryen.i32,
        false,
        ctx.mod.i32.const(stack_size + 4 + js_heap_size)
    );

    for (const { id, params, returnType } of program.body
        .map((x) => (x.type === "ExportNamedDeclaration" ? x.declaration : x))
        .filter((x): x is FunctionDeclaration => x.type === "FunctionDeclaration")) {
        ctx.variables.set(
            id.name,
            new DirectFunction(ctx, {
                classification: "function",
                name: id.name,
                sizeof: 0,
                implementation: {
                    params: params.map(({ typeAnnotation }) => parseType(ctx, typeAnnotation)),
                    results: parseType(ctx, returnType)
                }
            })
        );
    }

    for (const struct of program.body.filter((x) => x.type === "StructDeclaration")) {
        for (const { id, params, returnType } of struct.methods) {
            (ctx.types[struct.id.name] as InstanceStructTypeInformation).methods.set(id.name, {
                classification: "function",
                name: `${struct.id.name}.${id.name}`,
                sizeof: 0,
                implementation: {
                    params: params.map(({ typeAnnotation }) => parseType(ctx, typeAnnotation)),
                    results: parseType(ctx, returnType)
                }
            });

            // TODO: this shouldn't be necessary
            ctx.variables.set(
                `${struct.id.name}.${id.name}`,
                new DirectFunction(ctx, {
                    classification: "function",
                    name: `${struct.id.name}.${id.name}`,
                    sizeof: 0,
                    implementation: {
                        params: params.map(({ typeAnnotation }) => parseType(ctx, typeAnnotation)),
                        results: parseType(ctx, returnType)
                    }
                })
            );
        }
    }

    for (const type of ["i32", "i64", "f32", "f64"] as const) {
        ctx.variables.set(
            `log_${type}`,
            new DirectFunction(ctx, {
                classification: "function",
                name: `log_${type}`,
                sizeof: 0,
                implementation: {
                    params: [ctx.types[type]],
                    results: ctx.types.void
                }
            })
        );
    }

    for (const node of program.body) {
        switch (node.type) {
            case "ExportNamedDeclaration":
            case "FunctionDeclaration":
            case "StructDeclaration":
                handleDeclaration(ctx, node);
                break;
            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

    const fns = ctx.captured_functions;
    mod.addTable(VIRTUALIZED_FUNCTIONS, fns.length, fns.length);
    mod.addActiveElementSegment(VIRTUALIZED_FUNCTIONS, "initializer", fns, mod.i32.const(0));
    mod.addTableExport(VIRTUALIZED_FUNCTIONS, "$table");

    return mod;
}

function handleDeclaration(ctx: Context, node: Declaration): void {
    switch (node.type) {
        case "ExportNamedDeclaration":
            handleDeclaration(ctx, node.declaration);
            const { declaration } = node;
            if (declaration.type === "FunctionDeclaration") {
                ctx.mod.addFunctionExport(declaration.id.name, declaration.id.name);
            } else if (declaration.type === "VariableDeclaration") {
                for (const { id } of declaration.declarations) {
                    ctx.mod.addGlobalExport(id.name, id.name);
                }
            } else if (declaration.type === "StructDeclaration") {
                // struct exports don't carry any runtime weight
            } else {
                throw new Error(`Unknown export type: ${declaration.type}`);
            }
            break;
        case "FunctionDeclaration":
            buildFunctionDeclaration(ctx, node);
            break;
        case "StructDeclaration":
            for (const decl of node.methods) {
                decl.id.name = `${node.id.name}.${decl.id.name}`;
                buildFunctionDeclaration(ctx, decl);
            }
            break;
    }
}

function buildFunctionDeclaration(ctx: Context, node: FunctionDeclaration): void {
    let local_count = 0;
    const parent_scope = new Map(ctx.variables);
    ctx.variables = new Map(ctx.variables);

    const params = new Map(
        node.params.map(({ name, typeAnnotation }) => {
            const local_index = local_count++;
            const type = parseType(ctx, typeAnnotation);
            const local = new LocalPrimitive(
                ctx,
                type.classification === "primitive" ? type : Primitive.primitives.get("u32")!,
                local_index
            );
            let obj: MiteType;
            if (type.classification === "primitive") {
                obj = local;
            } else if (type.classification === "array") {
                obj = new Array_(ctx, type, new Pointer(local));
            } else if (type.classification === "struct") {
                obj = new Struct(ctx, type, new Pointer(local));
            } else if (type.classification === "function") {
                obj = new IndirectFunction(ctx, type, new Pointer(local));
            } else {
                // @ts-expect-error unreachable
                type.classification;
                obj = undefined as never;
            }
            return [name.name, obj];
        })
    );
    Array.from(params.entries()).forEach(([key, val]) => ctx.variables.set(key, val));

    const current_function = (ctx.current_function = {
        ...(lookForVariable(ctx, node.id.name).type as InstanceFunctionInformation).implementation,
        stack_frame_size: 0,
        local_count
    });

    const function_body = newBlock(ctx, () =>
        node.body.body.forEach((statement) => statementToExpression(ctx, statement))
    );

    const function_variables = Array.from(ctx.variables.entries())
        .filter(([name]) => !params.has(name))
        .filter(([_, mitetype]) => !(mitetype instanceof DirectFunction))
        .map(([, { type }]) => type);

    miteSignatureToBinaryenSignature(
        ctx,
        current_function,
        node.id.name,
        function_variables,
        function_body.get_expression_ref()
    );

    ctx.variables = parent_scope;
}

function statementToExpression(ctx: Context, value: Statement): void {
    switch (value.type) {
        case "VariableDeclaration":
            return variableDeclarationToExpression(ctx, value);
        case "ReturnStatement":
            return returnStatementToExpression(ctx, value);
        case "ExpressionStatement":
            ctx.current_block.push(expressionToExpression(ctx, value.expression));
            return;
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function variableDeclarationToExpression(ctx: Context, value: VariableDeclaration): void {
    for (const { id, typeAnnotation, init } of value.declarations) {
        let expr: MiteType | undefined = undefined;
        let type: InstanceTypeInformation;
        if (typeAnnotation && init) {
            expr = expressionToExpression(
                updateExpected(ctx, parseType(ctx, typeAnnotation)),
                init
            );
            type = expr.type;
        } else if (typeAnnotation) {
            type = parseType(ctx, typeAnnotation);
        } else if (init) {
            expr = expressionToExpression(ctx, init);
            type = expr.type;
        } else {
            throw new Error("Variable declaration must have type or initializer");
        }

        const local = createMiteType(ctx, type, ctx.current_function.local_count++);

        if (type.classification === "struct") {
            ctx.current_block.push(local.set(allocate(ctx, type, type.sizeof)));
        } else if (type.classification === "array") {
            ctx.current_block.push(local.set(constructArray(ctx, type)));
        }

        if (expr) ctx.current_block.push(local.set(expr));
        ctx.variables.set(id.name, local);
    }
}

function returnStatementToExpression(ctx: Context, value: ReturnStatement): void {
    const expr =
        value.argument &&
        expressionToExpression(updateExpected(ctx, ctx.current_function.results), value.argument);

    ctx.current_block.push(
        new TransientPrimitive(ctx, ctx.types.void, ctx.mod.return(expr?.get_expression_ref()))
    );
}

function expressionToExpression(ctx: Context, value: Expression): MiteType {
    if (value.type === "Literal") {
        return literalToExpression(ctx, value);
    } else if (value.type === "Identifier") {
        return identifierToExpression(ctx, value);
    } else if (value.type === "BinaryExpression") {
        return binaryExpressionToExpression(ctx, value);
    } else if (value.type === "LogicalExpression") {
        return logicalExpressionToExpression(ctx, value);
    } else if (value.type === "AssignmentExpression") {
        return assignmentExpressionToExpression(ctx, value);
    } else if (value.type === "CallExpression") {
        return callExpressionToExpression(ctx, value);
    } else if (value.type === "IfExpression") {
        return ifExpressionToExpression(ctx, value);
    } else if (value.type === "ForExpression") {
        return forExpressionToExpression(ctx, value);
    } else if (value.type === "BlockExpression") {
        return blockExpressionToExpression(ctx, value);
    } else if (value.type === "DoWhileExpression") {
        return doWhileExpressionToExpression(ctx, value);
    } else if (value.type === "WhileExpression") {
        return whileExpressionToExpression(ctx, value);
    } else if (value.type === "EmptyExpression") {
        return emptyExpressionToExpression(ctx, value);
    } else if (value.type === "ContinueExpression") {
        return continueExpressionToExpression(ctx, value);
    } else if (value.type === "BreakExpression") {
        return breakExpressionToExpression(ctx, value);
    } else if (value.type === "MemberExpression") {
        return memberExpressionToExpression(ctx, value);
    } else if (value.type === "ArrayExpression") {
        return arrayExpressionToExpression(ctx, value);
    } else if (value.type === "IndexExpression") {
        return indexExpressionToExpression(ctx, value);
    } else if (value.type === "ObjectExpression") {
        return objectExpressionToExpression(ctx, value);
    } else if (value.type === "SequenceExpression") {
        return expressionToExpression(ctx, value.expressions[0]);
    } else {
        switch (value.type) {
            case "AwaitExpression":
            case "ChainExpression":
            case "FunctionExpression":
            case "ImportExpression":
            case "MetaProperty":
            case "TaggedTemplateExpression":
            case "TemplateLiteral":
            case "ThisExpression":
            case "UnaryExpression":
            case "UpdateExpression":
            case "YieldExpression":
                throw new Error(`Currently unsupported statement type: ${value.type}`);
            default:
                // @ts-expect-error value should be `never` here
                throw new Error(`Unknown statement type: ${value.type}`);
        }
    }
}

function literalToExpression(ctx: Context, value: Literal): MiteType {
    if (ctx.expected?.classification && ctx.expected.classification !== "primitive")
        throw new Error(`Expected primitive type, got ${ctx.expected?.classification}`);

    const type = ctx.expected ?? (ctx.types[value.literalType] as InstancePrimitiveTypeInformation);
    let ref;
    switch (type.name) {
        // case "bool":
        //     if (typeof value.value !== "boolean") throw new Error("Expected boolean literal");
        //     ref = ctx.mod.i32.const(value.value ? 1 : 0);
        //     break;
        case "bool":
        case "i8":
        case "u8":
        case "i16":
        case "u16":
        case "i32":
        case "u32":
            if (typeof value.value !== "number" && typeof value.value !== "bigint")
                throw new Error("Expected numerical literal");
            ref = ctx.mod.i32.const(Number(value.value));
            break;
        case "i64":
        case "u64":
            if (typeof value.value !== "number" && typeof value.value !== "bigint")
                throw new Error("Expected numerical literal");
            ref = ctx.mod.i64.const(...bigintToLowAndHigh(value.value));
            break;
        case "f32":
            if (typeof value.value !== "number" && typeof value.value !== "bigint")
                throw new Error("Expected numerical literal");
            ref = ctx.mod.f32.const(Number(value.value));
            break;
        case "f64":
            if (typeof value.value !== "number" && typeof value.value !== "bigint")
                throw new Error("Expected numerical literal");
            ref = ctx.mod.f64.const(Number(value.value));
            break;
        case "f32x4":
        case "f64x2":
        case "i64x2":
        case "u64x2":
        case "i32x4":
        case "u32x4":
        case "i16x8":
        case "u16x8":
        case "i8x16":
        case "u8x16":
            if (typeof value.value !== "object") throw new Error("Expected SIMD literal");
            ref = ctx.mod.v128.const(value.value);
            break;
        default:
            throw new Error(`Unknown literal type: ${type}`);
    }
    return new TransientPrimitive(ctx, type, ref);
}

function identifierToExpression(ctx: Context, { name }: Identifier): MiteType {
    return lookForVariable(ctx, name);
}

function binaryExpressionToExpression(ctx: Context, value: BinaryExpression): MiteType {
    const left = expressionToExpression(updateExpected(ctx, undefined), value.left);
    const right = expressionToExpression(updateExpected(ctx, left.type), value.right);

    const operator = left.operator(value.operator);
    return operator(left, right);
}

function logicalExpressionToExpression(ctx: Context, value: LogicalExpression): MiteType {
    const left = expressionToExpression(updateExpected(ctx, ctx.types.bool), value.left),
        right = expressionToExpression(updateExpected(ctx, ctx.types.bool), value.right);

    switch (value.operator) {
        case TokenType.LOGICAL_OR:
            return new TransientPrimitive(
                ctx,
                ctx.types.bool,
                ctx.mod.if(
                    left.get_expression_ref(),
                    ctx.mod.i32.const(1),
                    ctx.mod.i32.ne(right.get_expression_ref(), ctx.mod.i32.const(0))
                )
            );
        case TokenType.LOGICAL_AND:
            return new TransientPrimitive(
                ctx,
                ctx.types.bool,
                ctx.mod.if(
                    ctx.mod.i32.eqz(left.get_expression_ref()),
                    ctx.mod.i32.const(0),
                    ctx.mod.i32.ne(right.get_expression_ref(), ctx.mod.i32.const(0))
                )
            );
    }

    throw new Error(`Unknown logical operator: ${value.operator}`);
}

function assignmentExpressionToExpression(ctx: Context, value: AssignmentExpression): MiteType {
    const variable = unwrapVariable(ctx, value.left);

    const expr = expressionToExpression(updateExpected(ctx, variable.type), value.right);
    if (value.operator === "=") return variable.set(expr);
    if (variable.type.classification !== "primitive")
        throw new Error("Cannot use operator assignment on non-primitive type");

    const operation = value.operator.slice(0, -1) as BinaryOperator;
    const operator = variable.operator(operation);

    return variable.set(operator(variable, expr));
}

function callExpressionToExpression(ctx: Context, value: CallExpression): MiteType {
    let args;

    if (value.callee.type === "Identifier") {
        const name = value.callee.name;
        if (intrinsic_names.has(name)) {
            args = value.arguments.map((arg) => expressionToExpression(ctx, arg));
            const primary_argument = args[0]?.type.name;

            if (!primary_argument) throw new Error("Intrinsic must have primary argument");
            const intrinsic = ctx.intrinsics[primary_argument][name];
            if (!intrinsic)
                throw new Error(`Intrinsic ${name} not defined for ${primary_argument}`);
            // @ts-expect-error this is fine
            return intrinsic(...args);
        } else if (!Object.values(ctx.conversions).every((x) => !Object.hasOwn(x, name))) {
            args = value.arguments.map((arg) => expressionToExpression(ctx, arg));
            const primary_argument = args[0]?.type.name;

            if (ctx.conversions[primary_argument]?.[name]) {
                return ctx.conversions[primary_argument][name](args[0]);
            }
        }
    }

    const fn = expressionToExpression(ctx, value.callee);
    if (fn.type.classification !== "function") {
        throw new Error(`Cannot call non-function type ${fn.type.name}`);
    }

    const thisless_params =
        fn instanceof StructMethod
            ? fn.type.implementation.params.slice(1)
            : fn.type.implementation.params;

    if (thisless_params.length !== value.arguments.length) {
        throw new Error(
            `Expected ${thisless_params.length} arguments, got ${value.arguments.length} in call to ${fn.type.name}`
        );
    }

    args ??= thisless_params.map((type, i) =>
        expressionToExpression(updateExpected(ctx, type), value.arguments[i])
    );

    return fn.call(args);
}

function ifExpressionToExpression(ctx: Context, value: IfExpression): MiteType {
    const condition = expressionToExpression(updateExpected(ctx, ctx.types.bool), value.test);
    const true_branch = expressionToExpression(ctx, value.consequent);
    const false_branch = value.alternate && expressionToExpression(ctx, value.alternate);

    if (false_branch && true_branch.type.name !== false_branch.type.name) {
        throw new Error(
            `If branches must have same type, got ${true_branch.type.name} and ${false_branch.type.name}`
        );
    }

    return fromExpressionRef(
        ctx,
        true_branch.type,
        ctx.mod.if(
            condition.get_expression_ref(),
            true_branch.get_expression_ref(),
            false_branch?.get_expression_ref()
        )
    );
}

function forExpressionToExpression(ctx: Context, value: ForExpression): MiteType {
    const for_loop_container_label = `ForLoopOuterContainerBlock$${ctx.stacks.depth}`;
    const for_loop_loop_part_label = `ForLoopBodyTestUpdateLoop$${ctx.stacks.depth}`;
    const for_loop_user_body_label = `ForLoopUserDefinedBody$${ctx.stacks.depth}`;

    // breaks break out of the whole loop
    ctx.stacks.break.push(for_loop_container_label);

    // this is not a mistake; continues need to break out of the main body and re-execute
    // update and test, and main_body only contains the user-defined body
    ctx.stacks.continue.push(for_loop_user_body_label);
    ctx.stacks.depth++;

    const ref = newBlock(
        ctx,
        () => {
            if (value.init) {
                if (value.init.type === "VariableDeclaration") {
                    variableDeclarationToExpression(ctx, value.init);
                } else {
                    expressionToExpression(ctx, value.init);
                }
            }

            const test =
                value.test &&
                (value.test.type === "EmptyExpression"
                    ? ctx.mod.i32.const(1)
                    : newBlock(
                          ctx,
                          () =>
                              expressionToExpression(
                                  updateExpected(ctx, ctx.types.bool),
                                  value.test!
                              ),
                          { type: binaryen.i32 }
                      ).get_expression_ref());

            const update =
                value.update && newBlock(ctx, () => expressionToExpression(ctx, value.update!));
            const body = newBlock(ctx, () => expressionToExpression(ctx, value.body), {
                name: for_loop_user_body_label
            });

            if (test) {
                // if test fails, don't even start the loop
                ctx.current_block.push(
                    new TransientPrimitive(
                        ctx,
                        ctx.types.void,
                        ctx.mod.br_if(
                            for_loop_container_label,
                            ctx.mod.i32.eqz(ctx.mod.copyExpression(test))
                        )
                    )
                );
            }

            const for_loop_loop_part = [];

            for_loop_loop_part.push(body.get_expression_ref());
            if (update) for_loop_loop_part.push(update.get_expression_ref());
            if (test) for_loop_loop_part.push(ctx.mod.br_if(for_loop_loop_part_label, test));

            ctx.current_block.push(
                new TransientPrimitive(
                    ctx,
                    ctx.types.void,
                    ctx.mod.loop(for_loop_loop_part_label, ctx.mod.block(null, for_loop_loop_part))
                )
            );
        },
        { name: for_loop_container_label }
    );

    ctx.stacks.break.pop();
    ctx.stacks.continue.pop();

    return ref;
}

function doWhileExpressionToExpression(ctx: Context, value: DoWhileExpression): MiteType {
    const do_while_loop_container_block = `DoWhileLoopContainerBlock$${ctx.stacks.depth}`;
    const do_while_loop_body_block = `DoWhileLoopBody$${ctx.stacks.depth}`;
    ctx.stacks.break.push(do_while_loop_container_block);
    ctx.stacks.continue.push(do_while_loop_body_block);
    ctx.stacks.depth++;

    const body = newBlock(ctx, () => expressionToExpression(ctx, value.body));
    const test = value.test
        ? newBlock(
              ctx,
              () => expressionToExpression(updateExpected(ctx, ctx.types.bool), value.test),
              { type: binaryen.i32 }
          )
        : new TransientPrimitive(ctx, ctx.types.i32, ctx.mod.i32.const(0));

    const ref = ctx.mod.loop(
        do_while_loop_body_block,
        ctx.mod.block(do_while_loop_container_block, [
            body.get_expression_ref(),
            ctx.mod.br_if(do_while_loop_body_block, test.get_expression_ref())
        ])
    );

    ctx.stacks.break.pop();
    ctx.stacks.continue.pop();

    return new TransientPrimitive(ctx, ctx.types.void, ref);
}

function whileExpressionToExpression(ctx: Context, value: WhileExpression): MiteType {
    const while_loop_container_block = `WhileLoopContainerBlock$${ctx.stacks.depth}`;
    const while_loop_body_block = `WhileLoopBody$${ctx.stacks.depth}`;
    ctx.stacks.break.push(while_loop_container_block);
    ctx.stacks.continue.push(while_loop_body_block);
    ctx.stacks.depth++;

    const test = newBlock(
        ctx,
        () => expressionToExpression(updateExpected(ctx, ctx.types.bool), value.test),
        { type: binaryen.i32 }
    );
    const body = newBlock(ctx, () => expressionToExpression(ctx, value.body));

    const ref = ctx.mod.if(
        test.get_expression_ref(), // if test.ref tries to continue or break it might be weird
        ctx.mod.block(while_loop_container_block, [
            ctx.mod.loop(
                while_loop_body_block,
                ctx.mod.block(null, [
                    body.get_expression_ref(),
                    ctx.mod.br_if(while_loop_body_block, test.get_expression_ref())
                ])
            )
        ])
    );

    ctx.stacks.break.pop();
    ctx.stacks.continue.pop();

    return new TransientPrimitive(ctx, ctx.types.void, ref);
}

function blockExpressionToExpression(ctx: Context, value: BlockExpression): MiteType {
    // note: currently can't break out of blocks
    const name = `Block$${ctx.stacks.depth}`;
    ctx.stacks.depth++;

    return newBlock(
        ctx,
        () => value.body.forEach((statement) => statementToExpression(ctx, statement)),
        { name, type: binaryen.auto }
    );
}

function continueExpressionToExpression(ctx: Context, _: ContinueExpression): MiteType {
    const loop = ctx.stacks.continue.at(-1);
    if (!loop) throw new Error("Cannot continue outside of loop");
    return new TransientPrimitive(ctx, ctx.types.void, ctx.mod.br(loop));
}

// todo: support labeled breaks;
function breakExpressionToExpression(ctx: Context, _: BreakExpression): MiteType {
    const block = ctx.stacks.break.at(-1);
    if (!block) throw new Error("Cannot break outside of a block");
    return new TransientPrimitive(ctx, ctx.types.void, ctx.mod.br(block));
}

function emptyExpressionToExpression(ctx: Context, _: EmptyExpression): MiteType {
    return new TransientPrimitive(ctx, ctx.types.void, ctx.mod.nop());
}

function memberExpressionToExpression(ctx: Context, value: MemberExpression): MiteType {
    const struct = expressionToExpression(ctx, value.object);
    if (struct.type.classification !== "struct")
        throw new Error("Cannot access member of non-struct");
    return struct.access(value.property.name);
}

function arrayExpressionToExpression(ctx: Context, value: ArrayExpression): MiteType {
    if (value.elements.length === 0) {
        throw new Error("Cannot create empty array");
    } else if (ctx.expected && ctx.expected.classification !== "array") {
        throw new Error(`Expected array type, got ${ctx.expected.classification}`);
    }

    const first_element = expressionToExpression(updateExpected(ctx, undefined), value.elements[0]);
    const element_type = first_element.type;

    const type = {
        classification: "array",
        name: `[${element_type.name}]`,
        sizeof: element_type.sizeof * value.elements.length + 4,
        element_type,
        length: value.elements.length,
        is_ref: false
    } as const;
    const ptr = constructArray(ctx, type);
    const array = new Array_(ctx, type, ptr);

    ctx.current_block.push(
        array
            .index(new TransientPrimitive(ctx, ctx.types.i32, ctx.mod.i32.const(0)))
            .set(first_element)
    );
    for (let i = 1; i < value.elements.length; i++) {
        const expr = expressionToExpression(updateExpected(ctx, element_type), value.elements[i]);
        ctx.current_block.push(
            array.index(new TransientPrimitive(ctx, ctx.types.i32, ctx.mod.i32.const(i))).set(expr)
        );
    }

    return array;
}

function indexExpressionToExpression(ctx: Context, value: IndexExpression): MiteType {
    const array = expressionToExpression(ctx, value.object);
    if (array.type.classification !== "array") {
        throw new Error(`Cannot index non-array type ${array.type.name}`);
    }
    const index = expressionToExpression(updateExpected(ctx, ctx.types.i32), value.index);

    return array.index(index);
}

function objectExpressionToExpression(ctx: Context, value: ObjectExpression): MiteType {
    const type = parseType(ctx, value.typeAnnotation);
    if (type.classification !== "struct") throw new Error("Cannot create non-struct object");

    const struct = createMiteType(ctx, type, allocate(ctx, type, type.sizeof));

    const fields = new Map(type.fields);
    for (const property of value.properties) {
        const field = fields.get(property.key.name);
        if (!field) throw new Error(`Struct ${type.name} has no field ${property.key.name}`);
        fields.delete(property.key.name);

        const expr = expressionToExpression(updateExpected(ctx, field.type), property.value);
        ctx.current_block.push(struct.access(property.key.name).set(expr));
    }

    // todo: zero out remaining fields
    if (fields.size !== 0) {
        throw new Error(`Struct ${type.name} has missing fields: ${Array.from(fields.keys())}`);
    }

    return struct;
}

function unwrapVariable(ctx: Context, variable: AssignmentExpression["left"]): MiteType {
    if (variable.type === "Identifier") {
        return lookForVariable(ctx, variable.name);
    } else if (variable.type === "MemberExpression") {
        const inner = variable.object;
        if (
            inner.type !== "Identifier" &&
            inner.type !== "MemberExpression" &&
            inner.type !== "IndexExpression"
        )
            throw new Error("Cannot unwrap non-identifier");
        const mite_type = unwrapVariable(ctx, inner);
        if (mite_type.type.classification !== "struct") throw new Error("Cannot unwrap non-struct");
        return mite_type.access(variable.property.name);
    } else if (variable.type === "IndexExpression") {
        const inner = variable.object;
        if (
            inner.type !== "Identifier" &&
            inner.type !== "MemberExpression" &&
            inner.type !== "IndexExpression"
        )
            throw new Error("Cannot unwrap non-identifier");
        const mite_type = unwrapVariable(ctx, inner);
        if (mite_type.type.classification !== "array") throw new Error("Cannot unwrap non-array");
        return mite_type.index(
            expressionToExpression(updateExpected(ctx, ctx.types.bool), variable.index)
        );
    } else {
        throw new Error(`Unknown variable type: ${variable}`);
    }
}
