import binaryen from "binaryen";
import {
    i64const,
    lookForVariable,
    miteSignatureToBinaryenSignature,
    newBlock,
    parseType,
    allocate,
    ARENA_HEAP_OFFSET,
    ARENA_HEAP_POINTER,
    fromExpressionRef,
    createMiteType,
    constructArray,
    VIRTUALIZED_FUNCTIONS,
    getCallbacks,
    addDataSegment,
    typeInformationToBinaryen,
    FN_PTRS_START,
    STRING_SECTION_START,
    assumeStructs
} from "./utils.js";
import {
    Context,
    InstanceFunctionTypeInformation,
    InstancePrimitiveTypeInformation,
    InstanceTypeInformation,
    intrinsic_names,
    StructTypeInformation
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
    ObjectExpression,
    UnaryExpression,
    ImportDeclaration,
    SequenceExpression
} from "../types/nodes.js";
import { BinaryOperator, TokenType } from "../types/tokens.js";
import {
    Array_,
    DirectFunction,
    IndirectFunction,
    LocalPrimitive,
    MiteType,
    Pointer,
    String_,
    Struct,
    StructMethod,
    TransientPrimitive
} from "./type_classes.js";
import {
    buildTypes,
    createConversions,
    createIntrinsics,
    getExportables
} from "./context_initialization.js";
import { addBuiltins } from "./builtin_functions.js";
import { Parser } from "../frontend/parser.js";
import { tokenize } from "../frontend/tokenizer.js";

export type Options = {
    resolveImport(path: string): Promise<{
        isMite: boolean;
        absolute: string;
        // maybe make this lazy
        code: string;
    }>;
};

export async function programToModule(
    program: Program,
    options: Options
): Promise<binaryen.Module> {
    const types = buildTypes(program);

    const callbacks = getCallbacks(assumeStructs(types), program);
    const RESERVED_FN_PTRS = callbacks.length;

    const mod = new binaryen.Module();
    // @ts-expect-error we add a couple things after ctx is initialized
    const ctx: Context = {
        mod,
        variables: new Map(),
        stacks: { continue: [], break: [], depth: 0 },
        types,
        current_block: [],
        captured_functions: [],
        string: {
            literals: new Map(),
            end: 0
        },
        constants: {
            RESERVED_FN_PTRS
        },
        current_function: { params: [], results: types.void, local_count: 0, is_init: true }
    };
    ctx.intrinsics = createIntrinsics(ctx);
    ctx.conversions = createConversions(ctx);
    addBuiltins(ctx);

    mod.setMemory(256, -1, null, [], false, false, "main_memory");
    mod.addMemoryImport("main_memory", "$mite", "$memory");

    for (const node of program.body.filter(
        (x): x is ImportDeclaration => x.type === "ImportDeclaration"
    )) {
        await handleDeclaration(ctx, node, options.resolveImport);
    }

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
                    params: params.map(({ name, typeAnnotation }) => ({
                        name: name.name,
                        type: parseType(ctx, typeAnnotation)
                    })),
                    results: parseType(ctx, returnType)
                },
                is_ref: false
            })
        );
    }

    for (const struct of Object.values(types).filter(
        (x): x is StructTypeInformation => x.classification === "struct"
    )) {
        for (const [method_name, method_type] of struct.methods) {
            // TODO: this shouldn't be necessary
            ctx.variables.set(
                `${struct.name}.${method_name}`,
                new DirectFunction(ctx, method_type)
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
                    params: [{ name: "value", type: ctx.types[type] }],
                    results: ctx.types.void
                },
                is_ref: false
            })
        );
    }

    const init = [];
    const start_locals = [];
    for (const node of program.body) {
        switch (node.type) {
            case "VariableDeclaration":
                await handleDeclaration(ctx, node, options.resolveImport);
                start_locals.push(
                    ...Array.from(ctx.variables.values())
                        .filter((x) => !x.is_global)
                        .map((x) => x.type)
                );
                ctx.variables.forEach(
                    (value, key) => !value.is_global && ctx.variables.delete(key)
                );
                init.push(...ctx.current_block.map((x) => x.get_expression_ref()));
                ctx.current_block = [];
                break;
            case "ExportNamedDeclaration":
            case "FunctionDeclaration":
            case "StructDeclaration":
                await handleDeclaration(ctx, node, options.resolveImport);
                break;
            case "ImportDeclaration":
                // already handled
                break;
            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

    ctx.current_block = [];

    for (const fn of callbacks) {
        const [params, result] = fn.split("|");
        const param_types = params.split(",").map((x) => Number(x));
        const result_type = Number(result);
        mod.addFunctionImport(
            fn,
            "$mite",
            `wrap_${fn}`,
            binaryen.createType([binaryen.i32, ...param_types]),
            result_type
        );
    }

    const encoder = new TextEncoder();
    const string_data = new Uint8Array(ctx.string.end);
    let position = 0;
    for (const [literal] of Array.from(ctx.string.literals.entries()).sort((a, b) => a[1] - b[1])) {
        const string_length = encoder.encodeInto(literal, string_data.subarray(position + 4));
        const view = new DataView(string_data.buffer);
        view.setUint32(position, string_length.written, true);
        position += 4 + string_length.written;
    }

    if (string_data.length > 0) {
        addDataSegment(ctx, "string_data", "main_memory", string_data);
    }

    const fns = [...callbacks, ...ctx.captured_functions];

    mod.addTableImport(VIRTUALIZED_FUNCTIONS, "$mite", "$table");
    // TODO: copy the logic for strings below for function poointers when binaryen adds table.init support
    // in the mean time, assume we have an imported global and 64 reserved spaces
    mod.addGlobalImport(FN_PTRS_START, "$mite", "$fn_ptrs_start", binaryen.i32, false);
    mod.addActiveElementSegment(
        VIRTUALIZED_FUNCTIONS,
        "initializer",
        fns,
        mod.global.get(FN_PTRS_START, binaryen.i32)
    );

    if (string_data.length > 0) {
        mod.addGlobal(STRING_SECTION_START, binaryen.i32, true, mod.i32.const(0));

        init.push(
            mod.global.set(STRING_SECTION_START, mod.global.get(ARENA_HEAP_POINTER, binaryen.i32)),
            mod.global.set(
                ARENA_HEAP_POINTER,
                mod.i32.add(
                    mod.global.get(ARENA_HEAP_POINTER, binaryen.i32),
                    mod.i32.const(string_data.length)
                )
            ),
            mod.memory.init(
                "string_data",
                mod.global.get(STRING_SECTION_START, binaryen.i32),
                mod.i32.const(0),
                mod.i32.const(string_data.length),
                "main_memory"
            ),
            mod.data.drop("string_data")
        );
    }

    mod.setStart(
        mod.addFunction(
            "$start",
            binaryen.none,
            binaryen.none,
            start_locals.map((x) => typeInformationToBinaryen(x)),
            mod.block(null, init)
        )
    );

    return mod;
}

async function handleDeclaration(
    ctx: Context,
    node: Declaration,
    resolveImport: Options["resolveImport"]
): Promise<void> {
    switch (node.type) {
        case "ExportNamedDeclaration":
            await handleDeclaration(ctx, node.declaration, resolveImport);
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
                // @ts-expect-error unreachable
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
        case "ImportDeclaration": {
            const import_file = node.source.value;
            const import_data = await resolveImport(import_file);
            if (!import_data.isMite) {
                for (const specifier of node.specifiers) {
                    if (!specifier.typeAnnotation) {
                        throw new Error("Non-Mite function imports must have type annotations");
                    }
                    const type = parseType(ctx, specifier.typeAnnotation);
                    if (type.classification !== "function") {
                        throw new Error("Only function imports are supported");
                    }
                    ctx.mod.addFunctionImport(
                        specifier.local.name,
                        import_file,
                        specifier.imported.name,
                        binaryen.createType(
                            type.implementation.params.map((x) => typeInformationToBinaryen(x.type))
                        ),
                        typeInformationToBinaryen(type.implementation.results)
                    );
                    ctx.variables.set(
                        specifier.local.name,
                        new DirectFunction(ctx, {
                            classification: "function",
                            name: specifier.local.name,
                            sizeof: 0,
                            implementation: type.implementation,
                            is_ref: false
                        })
                    );
                }
            } else {
                const possible_exports = getExportables(Parser.parse(tokenize(import_data.code)));

                for (const specifier of node.specifiers) {
                    const exportable = possible_exports[specifier.imported.name];
                    if (!exportable) {
                        throw new Error(
                            `No exportable named ${specifier.imported.name} in ${import_file}`
                        );
                    }
                    if (exportable.classification === "function") {
                        ctx.mod.addFunctionImport(
                            specifier.local.name,
                            import_file,
                            specifier.imported.name,
                            binaryen.createType(
                                exportable.implementation.params.map((x) =>
                                    typeInformationToBinaryen(x.type)
                                )
                            ),
                            typeInformationToBinaryen(exportable.implementation.results)
                        );

                        ctx.variables.set(
                            specifier.local.name,
                            new DirectFunction(ctx, { ...exportable, is_ref: false })
                        );
                    } else if (exportable.classification === "struct") {
                        ctx.types[specifier.local.name] = exportable;
                        for (const method of exportable.methods.values()) {
                            ctx.mod.addFunctionImport(
                                `${specifier.local.name}.${method.name}`,
                                import_file,
                                `${specifier.imported.name}.${method.name}`,
                                binaryen.createType(
                                    method.implementation.params.map((x) =>
                                        typeInformationToBinaryen(x.type)
                                    )
                                ),
                                typeInformationToBinaryen(method.implementation.results)
                            );

                            ctx.variables.set(
                                `${exportable.name}.${method.name}`,
                                new DirectFunction(ctx, method)
                            );
                        }
                    }
                }
            }
            break;
        }
        case "VariableDeclaration": {
            for (const { id, typeAnnotation, init } of node.declarations) {
                if (!typeAnnotation) {
                    throw new Error(
                        `Global variable declaration ${id.name} must have type annotation`
                    );
                }

                const type = parseType(ctx, typeAnnotation);
                const expr = init && expressionToExpression(ctx, init, type);

                const global = createMiteType(ctx, type, id.name);

                if (type.classification === "struct" || type.classification === "function") {
                    ctx.current_block.push(global.set(allocate(ctx, type, type.sizeof)));
                } else if (type.classification === "array") {
                    ctx.current_block.push(global.set(constructArray(ctx, type)));
                }

                if (expr) ctx.current_block.push(global.set(expr));
                ctx.variables.set(id.name, global);
            }
            break;
        }
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
                type.classification === "primitive" ? type : Pointer.type,
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
            } else if (type.classification === "string") {
                obj = new String_(ctx, new Pointer(local));
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
        ...(lookForVariable(ctx, node.id.name).type as InstanceFunctionTypeInformation)
            .implementation,
        local_count,
        is_init: false
    });

    const function_body = newBlock(ctx, () =>
        node.body.body.forEach((statement) => statementToExpression(ctx, statement))
    );

    const function_variables = Array.from(ctx.variables.entries())
        .filter(([name]) => !params.has(name))
        .filter(([_, mitetype]) => !mitetype.is_global)
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
            ctx.current_block.push(expressionToExpression(ctx, value.expression, undefined));
            return;
    }

    throw new Error(`Unknown statement type: ${value.type}`);
}

function variableDeclarationToExpression(ctx: Context, value: VariableDeclaration): void {
    for (const { id, typeAnnotation, init } of value.declarations) {
        let expr: MiteType | undefined = undefined;
        let type: InstanceTypeInformation;
        if (typeAnnotation && init) {
            type = parseType(ctx, typeAnnotation);
            expr = expressionToExpression(ctx, init, type);
        } else if (typeAnnotation) {
            type = parseType(ctx, typeAnnotation);
        } else if (init) {
            expr = expressionToExpression(ctx, init, undefined);
            type = expr.type;
        } else {
            throw new Error("Variable declaration must have type or initializer");
        }

        const local = createMiteType(ctx, type, ctx.current_function.local_count++);

        if (type.classification === "struct" || type.classification === "function") {
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
        value.argument && expressionToExpression(ctx, value.argument, ctx.current_function.results);

    ctx.current_block.push(
        new TransientPrimitive(ctx, ctx.types.void, ctx.mod.return(expr?.get_expression_ref()))
    );
}

function expressionToExpression(
    ctx_: Context,
    value: Expression | Statement,
    expected: InstanceTypeInformation | undefined
): MiteType {
    const ctx = { ...ctx_, expected };

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
    } else if (value.type === "UnaryExpression") {
        return unaryExpressionToExpression(ctx, value);
    } else if (value.type === "SequenceExpression") {
        return sequenceExpressionToExpression(ctx, value);
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
            case "UpdateExpression":
            case "YieldExpression":
                throw new Error(`Currently unsupported statement type: ${value.type}`);
            default:
                statementToExpression(ctx, value);
                return new TransientPrimitive(ctx, ctx.types.void, ctx.mod.nop());
        }
    }
}

const encoder = new TextEncoder();
function literalToExpression(ctx: Context, value: Literal): MiteType {
    if (
        ctx.expected?.classification &&
        ctx.expected.classification !== "primitive" &&
        ctx.expected.classification !== "string"
    )
        throw new Error(`Expected primitive type, got ${ctx.expected?.classification}`);

    const type = ctx.expected ?? (ctx.types[value.literalType] as InstancePrimitiveTypeInformation);
    let ref;
    switch (type.name) {
        case "string":
            if (typeof value.value !== "string") throw new Error("Expected string literal");
            const str = value.value;
            if (!ctx.string.literals.has(str)) {
                ctx.string.literals.set(str, ctx.string.end);
                // +4 for size
                ctx.string.end += encoder.encode(str).length + 4;
            }
            return new String_(
                ctx,
                new Pointer(
                    new TransientPrimitive(
                        ctx,
                        Pointer.type,
                        ctx.mod.i32.add(
                            ctx.mod.i32.const(ctx.string.literals.get(str)!),
                            ctx.mod.global.get(STRING_SECTION_START, binaryen.i32)
                        )
                    )
                )
            );
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
            ref = i64const(ctx, value.value);
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
        case "v128":
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
    const left = expressionToExpression(ctx, value.left, ctx.expected);
    const right = expressionToExpression(ctx, value.right, left.type);

    return left.operator(value.operator)(right);
}

function logicalExpressionToExpression(ctx: Context, value: LogicalExpression): MiteType {
    const left = expressionToExpression(ctx, value.left, ctx.types.bool);
    const right = expressionToExpression(ctx, value.right, ctx.types.bool);

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
    const variable = expressionToExpression(ctx, value.left, ctx.expected);

    const expr = expressionToExpression(ctx, value.right, variable.type);
    if (value.operator === "=") return variable.set(expr);

    const operation = value.operator.slice(0, -1) as BinaryOperator;
    return variable.set(variable.operator(operation)(expr));
}

function callExpressionToExpression(ctx: Context, value: CallExpression): MiteType {
    let args;

    if (value.callee.type === "Identifier") {
        const name = value.callee.name;
        if (intrinsic_names.has(name)) {
            args = value.arguments.map((arg) => expressionToExpression(ctx, arg, undefined));
            const primary_argument = args[0]?.type.name;

            if (!primary_argument) throw new Error("Intrinsic must have primary argument");
            const intrinsic = ctx.intrinsics[primary_argument][name];
            if (!intrinsic)
                throw new Error(`Intrinsic ${name} not defined for ${primary_argument}`);
            // @ts-expect-error this is fine
            return intrinsic(...args);
        } else if (!Object.values(ctx.conversions).every((x) => !Object.hasOwn(x, name))) {
            args = value.arguments.map((arg) => expressionToExpression(ctx, arg, undefined));
            const primary_argument = args[0]?.type.name;

            if (ctx.conversions[primary_argument]?.[name]) {
                return ctx.conversions[primary_argument][name](args[0]);
            }
        }
    }

    const fn = expressionToExpression(ctx, value.callee, undefined);
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
        expressionToExpression(ctx, value.arguments[i], type.type)
    );

    return fn.call(args);
}

function ifExpressionToExpression(ctx: Context, value: IfExpression): MiteType {
    const condition = expressionToExpression(ctx, value.test, ctx.types.bool);
    const true_branch = expressionToExpression(ctx, value.consequent, ctx.expected);
    const false_branch =
        value.alternate && expressionToExpression(ctx, value.alternate, ctx.expected);

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
                    expressionToExpression(ctx, value.init, undefined);
                }
            }

            const test =
                value.test &&
                (value.test.type === "EmptyExpression"
                    ? ctx.mod.i32.const(1)
                    : newBlock(
                          ctx,
                          () => expressionToExpression(ctx, value.test!, ctx.types.bool),
                          { type: binaryen.i32 }
                      ).get_expression_ref());

            const update =
                value.update &&
                newBlock(ctx, () => expressionToExpression(ctx, value.update!, undefined));

            const body = newBlock(
                ctx,
                () => expressionToExpression(ctx, value.body, ctx.expected),
                {
                    name: for_loop_user_body_label
                }
            );

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

    const body = newBlock(ctx, () => expressionToExpression(ctx, value.body, ctx.expected));
    const test = value.test
        ? newBlock(ctx, () => expressionToExpression(ctx, value.test, ctx.types.bool), {
              type: binaryen.i32
          })
        : new TransientPrimitive(ctx, ctx.types.bool, ctx.mod.i32.const(0));

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

    const test = newBlock(ctx, () => expressionToExpression(ctx, value.test, ctx.types.bool), {
        type: binaryen.i32
    });
    const body = newBlock(ctx, () => expressionToExpression(ctx, value.body, ctx.expected));

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
    const struct = expressionToExpression(ctx, value.object, undefined);
    return struct.access(value.property.name);
}

function arrayExpressionToExpression(ctx: Context, value: ArrayExpression): MiteType {
    if (value.elements.length === 0) {
        throw new Error("Cannot create empty array");
    } else if (ctx.expected && ctx.expected.classification !== "array") {
        throw new Error(`Expected array type, got ${ctx.expected.classification}`);
    }

    const first_element = expressionToExpression(
        ctx,
        value.elements[0],
        ctx.expected?.element_type
    );
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
            .index(new TransientPrimitive(ctx, Pointer.type, ctx.mod.i32.const(0)))
            .set(first_element)
    );
    for (let i = 1; i < value.elements.length; i++) {
        const expr = expressionToExpression(ctx, value.elements[i], element_type);
        ctx.current_block.push(
            array.index(new TransientPrimitive(ctx, Pointer.type, ctx.mod.i32.const(i))).set(expr)
        );
    }

    return array;
}

function indexExpressionToExpression(ctx: Context, value: IndexExpression): MiteType {
    const array = expressionToExpression(
        ctx,
        value.object,
        ctx.expected && {
            classification: "array",
            name: `[${ctx.expected.name}]`,
            is_ref: false,
            sizeof: 0,
            element_type: ctx.expected
        }
    );
    const index = expressionToExpression(ctx, value.index, Pointer.type);

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

        const expr = expressionToExpression(ctx, property.value, field.type);
        ctx.current_block.push(struct.access(property.key.name).set(expr));
    }

    // todo: zero out remaining fields
    if (fields.size !== 0) {
        throw new Error(`Struct ${type.name} has missing fields: ${Array.from(fields.keys())}`);
    }

    return struct;
}

function unaryExpressionToExpression(ctx: Context, value: UnaryExpression): MiteType {
    const expr = expressionToExpression(ctx, value.argument, ctx.expected);
    return expr.operator(value.operator)();
}

function sequenceExpressionToExpression(ctx: Context, value: SequenceExpression): MiteType {
    return expressionToExpression(ctx, value.expressions[0], ctx.expected);
}
