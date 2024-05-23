import {
    ArrayTypeInformation,
    Context,
    FunctionTypeInformation,
    InstanceFunctionTypeInformation,
    PrimitiveTypeInformation,
    StringTypeInformation,
    StructTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import {
    ExportNamedDeclaration,
    FunctionDeclaration,
    ImportDeclaration,
    Program,
    StructDeclaration
} from "../types/nodes.js";
import { buildTypes } from "../backend/context_initialization.js";
import { IndirectFunction } from "../backend/type_classes.js";
import { assumeStructs, functionToSignature, getCallbacks, parseType } from "../backend/utils.js";
import dedent from "dedent";

interface Accessors {
    getter: string;
    setter: string;
}

interface Conversion {
    setup?: string;
    expression: string;
}

type DataViewGetterTypes =
    Extract<keyof DataView, `get${string}`> extends `get${infer T}` ? T : never;

export type Options = {
    createInstance(imports: string): { instantiation: string; setup?: string };
};

interface JSContext extends Context {
    callbacks: string[];
}

export function programToBoilerplate(program: Program, { createInstance }: Options) {
    const types = assumeStructs(buildTypes(program));
    const ctx = {
        types,
        callbacks: getCallbacks(types, program)
    } as JSContext;

    const exports = program.body
        .filter(
            (x): x is ExportNamedDeclaration =>
                x.type === "ExportNamedDeclaration" && x.declaration.type === "FunctionDeclaration"
        )
        .map((x) => x.declaration as FunctionDeclaration);

    const structs = program.body
        .map((x) => (x.type === "ExportNamedDeclaration" ? x.declaration : x))
        .filter((x): x is StructDeclaration => x.type === "StructDeclaration");
    const exported_structs = new Set(structs.map((x) => x.id.name));
    const methods = Object.fromEntries(
        structs.map((x) => [x.id.name, x.methods.map((y) => functionDeclarationToType(ctx, y))])
    );

    const imports = program.body.filter(
        (x): x is ImportDeclaration => x.type === "ImportDeclaration"
    );

    const js_import_strings = [];
    const wasm_import_strings = [""];
    for (const import_ of imports) {
        const imported_file = import_.source.value;
        if (!imported_file.endsWith(".mite")) {
            js_import_strings.push(
                `import { ${import_.specifiers
                    .map((x) => `${x.imported.name} as _${x.local.name}`)
                    .join(", ")} } from "${imported_file}";`
            );

            const specifiers = [];
            for (const { imported, local, typeAnnotation } of import_.specifiers) {
                if (!typeAnnotation) throw new Error("Type annotations are required for imports");
                const type = parseType(ctx, typeAnnotation);
                if (type.classification !== "function")
                    throw new Error("Only functions can be imported from non-mite files");

                specifiers.push(
                    `${imported.name}: ${adaptJSFunctionToMite(type, `_${local.name}`, "$result").replaceAll("\t", "        ")}`
                );
            }

            wasm_import_strings.push(`"${imported_file}": {
                ${specifiers.join(",\n                ")}
            }`);
        } else {
            // should get a better strategy for this
            const variable_safe_file = imported_file.replace(/[^a-zA-Z0-9]/g, "_");
            js_import_strings.push(
                `import { $exports as ${variable_safe_file}, ${import_.specifiers
                    .map((x) =>
                        x.local.name !== x.imported.name
                            ? `${x.imported.name} as ${x.local.name}`
                            : x.imported.name
                    )
                    .join(", ")} } from "${imported_file}";`
            );
            wasm_import_strings.push(`"${imported_file}": ${variable_safe_file}`);
        }
    }

    const { setup = "", instantiation } = createInstance(`{
            console,
            $mite: $setup$miteImports($table_start, (ptr, ...args) => $funcs[ptr](...args))${wasm_import_strings.join(",\n            ")}
        }`);

    let code = dedent`
        import {
            $memory, $table, $setup$miteImports,
            $toJavascriptFunction, $toJavascriptString, $fromJavascriptString, $arena_heap_malloc, $arena_heap_reset,
            $GetBigInt64, $GetBigUint64, $GetFloat32, $GetFloat64, $GetInt16, $GetInt32, $GetInt8, $GetUint16, $GetUint32, $GetUint8, $SetBigInt64, $SetBigUint64, $SetFloat32, $SetFloat64, $SetInt16, $SetInt32, $SetInt8, $SetUint16, $SetUint32, $SetUint8
        } from "mite:shared";
        ${js_import_strings.join("\n        ")}

        var $table_start = $table.grow(64);
        var $funcs = [];
        ${setup ? `\n${setup}\n` : ""}
        var $wasm = await ${instantiation};
        export var $exports = $wasm.instance.exports;
    `;

    code += "\n\n";

    for (const { sizeof, fields, name } of Object.values(ctx.types).filter(
        (x): x is StructTypeInformation => x.classification === "struct"
    )) {
        code += dedent`
            ${exported_structs.has(name) ? "export " : ""}class ${name} {
                static sizeof = ${sizeof};

                constructor(ptr) {
                    this._ = ptr;
                }${Array.from(fields.entries(), ([name, info]) => {
                    const { getter, setter } = typeToAccessors(info);

                    return `\n
                get ${name}() {
                    ${getter}
                }

                set ${name}($val) {
                    ${setter}
                }`;
                }).join("")}${methods[name]
                    .map((fn) => {
                        return `\n
                ${functionTypeInformationToString(ctx, fn).replaceAll("\t", " ".repeat(16))}`;
                    })
                    .join("")}
            }
        `;

        code += "\n\n";
    }

    for (const func of exports) {
        const type = functionDeclarationToType(ctx, func);

        if (isPrimitiveFunction(type)) {
            code += `export var ${type.name} = $exports.${type.name};`;
        } else {
            code += `export function ${functionTypeInformationToString(ctx, type).replaceAll("\t", "")}`;
        }

        code += "\n\n";
    }

    // remove second trailing newline
    return code.slice(0, -1);
}

type ValueOf<T> = T extends Map<unknown, infer V> ? V : never;

function typeToAccessors({ type, offset }: ValueOf<StructTypeInformation["fields"]>): Accessors {
    const ptr = type.is_ref ? `$GetUint32(this._ + ${offset})` : `this._ + ${offset}`;

    if (type.classification === "primitive") {
        if (type.name === "void") return { getter: "return undefined", setter: "" };
        if (type.name === "bool") {
            return {
                getter: `return !!$GetInt32(${ptr});`,
                setter: `$SetInt32(${ptr}, !!$val);`
            };
        }

        const typed_name = primitiveToTypedName(type.name);
        return {
            getter: `return $Get${typed_name}(${ptr});`,
            setter: `$Set${typed_name}(${ptr}, $val);`
        };
    } else if (type.classification === "struct") {
        // TODO: handle non-ref setters
        const getter = structToJavascript(ptr, type);
        return {
            getter: `${getter.setup}; return ${getter.expression};`,
            setter: type.is_ref ? `$SetUint32(${ptr}, $val._);` : ""
        };
    } else if (type.classification === "array") {
        // TODO: handle non-ref setters
        const getter = arrayToJavascript(ptr, type);
        return {
            getter: `${getter.setup}; return ${getter.expression};`,
            setter: type.is_ref ? `$SetUint32(${ptr}, $val._);` : ""
        };
    } else if (type.classification === "function") {
        const getter = functionToJavascript(ptr, type);
        return {
            getter: `${getter.setup}; return ${getter.expression};`,
            setter: ""
        };
    } else if (type.classification === "string") {
        const getter = stringToJavascript(ptr, type);
        return {
            getter: `${getter.setup}; return ${getter.expression};`,
            setter: `$SetUint32(${ptr}, $fromJavascriptString($val));`
        };
    } else {
        // @ts-expect-error unreachable probably
        throw new Error(`Unknown type: ${type.classification}`);
    }
}

function primitiveToTypedName(primitive: string): DataViewGetterTypes {
    switch (primitive) {
        case "i8":
        case "i8x16":
            return "Int8";
        case "i16":
        case "i16x8":
            return "Int16";
        // bool and v128 should just be whatever the fastest integer type is
        case "bool":
        case "v128":
        case "i32":
        case "i32x4":
            return "Int32";
        case "i64":
        case "i64x2":
            return "BigInt64";
        case "u8":
        case "u8x16":
            return "Uint8";
        case "u16":
        case "u16x8":
            return "Uint16";
        case "u32":
        case "u32x4":
            return "Uint32";
        case "u64":
        case "u64x2":
            return "BigUint64";
        case "f32":
        case "f32x4":
            return "Float32";
        case "f64":
        case "f64x2":
            return "Float64";
        default:
            throw new Error(`Unknown primitive: ${primitive}`);
    }
}

function functionTypeInformationToString(
    ctx: JSContext,
    { name, implementation: { params, results } }: FunctionTypeInformation
) {
    if (params[0]?.name === "this") params.shift();

    const callbacks = params
        .map((x) => x.type)
        .filter((x): x is InstanceFunctionTypeInformation => x.classification === "function");
    for (const callback of callbacks) {
        const sig = functionToSignature(callback);
        // @ts-expect-error idx is added in functionDeclarationToString
        callback.idx = ctx.callbacks.indexOf(sig);
    }

    const args = params.map((param) => javascriptToMite(param.name, param.type));
    const args_setup = args
        .map((x) => x.setup)
        .filter(Boolean)
        .join("\n\n\t    ");
    const args_setup_str = args_setup ? `\n\t    ${args_setup}\n` : "";
    const args_expression = args.map((x) => x.expression).join(", ");

    const callbacks_cleanup_str = callbacks.length
        ? `\n\t    ${callbacks.map(() => `$funcs.pop();`).join("\n\t    ")}\n`
        : "";

    const { setup, expression } = miteToJavascript("$result", results);
    const setup_str = setup ? `\n\t    ${setup}` : "";

    // make it look nicer when the result var isn't needed
    if (setup_str === "" && callbacks_cleanup_str === "") {
        return `${name}(${params.map((x) => x.name).join(", ")}) {${args_setup_str}
\t    return ${expression.replace("$result", `$exports.${name}(${args_expression})`)};
\t}`;
    }
    return `${name}(${params.map((x) => x.name).join(", ")}) {${args_setup_str}
\t    var $result = $exports.${name}(${args_expression});
\t${setup_str}${callbacks_cleanup_str}
\t    return ${expression};
\t}`;
}

function javascriptToMite(ptr: string, type: TypeInformation): Conversion {
    if (type.classification === "primitive") {
        return primitiveToMite(ptr, type);
    } else if (type.classification === "struct") {
        return structToMite(ptr, type);
    } else if (type.classification === "array") {
        return arrayToMite(ptr, type);
    } else if (type.classification === "function") {
        return functionToMite(ptr, type);
    } else if (type.classification === "string") {
        return stringToMite(ptr, type);
    } else {
        // @ts-expect-error unreachable probably
        throw new Error(`Unknown type: ${type.classification}`);
    }
}

function primitiveToMite(ptr: string, _type: PrimitiveTypeInformation): Conversion {
    return { expression: ptr };
}

function structToMite(ptr: string, _type: StructTypeInformation): Conversion {
    return { expression: `${ptr}._` };
}

function arrayToMite(ptr: string, _type: ArrayTypeInformation): Conversion {
    return { expression: `${ptr}._` };
}

function adaptJSFunctionToMite(fn: FunctionTypeInformation, function_name: string, result: string) {
    if (isPrimitiveFunction(fn)) return function_name;

    const {
        implementation: { params, results }
    } = fn;
    const args = params.map((x) => miteToJavascript(x.name, x.type));
    const args_setup = args
        .map((x) => x.setup)
        .filter(Boolean)
        .join("\n                ");
    const args_setup_str = args_setup ? `\n                ${args_setup}` : "";
    const args_expression = args.map((x) => x.expression).join(", ");

    const { setup, expression } = miteToJavascript(result, results);
    const setup_str = setup ? `\n                ${setup}` : "";

    if (args_setup_str === "" && setup_str === "") {
        return `(${params.map((x) => x.name).join(", ")}) => ${expression.replace(result, `${function_name}(${args_expression})`)}`;
    } else if (setup_str === "") {
        return `(${params.map((x) => x.name).join(", ")}) => {${args_setup_str}
\t            return ${expression.replace(result, `${function_name}(${args_expression})`)};
\t        }`;
    }
    return `(${params.map((x) => x.name).join(", ")}) => {${args_setup_str}
\t            var ${result} = ${function_name}(${args_expression});${setup_str}
\t            return ${expression};
\t        }`;
}

function functionToMite(ptr: string, fn: FunctionTypeInformation): Conversion {
    const fn_name = `$mite_${ptr}`;

    return {
        setup: `\tvar ${fn_name} = 0;
\t    if (Object.hasOwn(${ptr}, '_')) {
\t        ${fn_name} = ${ptr}._;
\t    } else {
\t        ${fn_name} = $arena_heap_malloc(${IndirectFunction.struct_type.sizeof});
\t        $SetUint32(${fn_name}, $table_start + ${
            // @ts-expect-error idx is added in functionDeclarationToString
            fn.idx
        });
\t        $SetUint32(${fn_name} + 4, $funcs.length);
\t        $funcs.push(${adaptJSFunctionToMite(fn, ptr, `${fn_name}_result`)});
\t    }`,
        expression: fn_name
    };
}

function stringToMite(ptr: string, _type: StringTypeInformation): Conversion {
    return { expression: `$fromJavascriptString(${ptr})` };
}

function miteToJavascript(ptr: string, type: TypeInformation): Conversion {
    if (type.classification === "primitive") {
        return primitiveToJavascript(ptr, type);
    } else if (type.classification === "struct") {
        return structToJavascript(ptr, type);
    } else if (type.classification === "array") {
        return arrayToJavascript(ptr, type);
    } else if (type.classification === "function") {
        return functionToJavascript(ptr, type);
    } else if (type.classification === "string") {
        return stringToJavascript(ptr, type);
    } else {
        // @ts-expect-error unreachable probably
        throw new Error(`Unknown type: ${type.classification}`);
    }
}

function primitiveToJavascript(ptr: string, type: PrimitiveTypeInformation): Conversion {
    if (type.name === "bool") return { expression: `!!(${ptr})` };
    return { expression: ptr };
}

function structToJavascript(ptr: string, type: StructTypeInformation): Conversion {
    return { expression: `new ${type.name}(${ptr})` };
}

function arrayToJavascript(ptr: string, type: ArrayTypeInformation): Conversion {
    if (type.element_type.classification === "primitive") {
        const typed_name = primitiveToTypedName(type.element_type.name);
        return {
            setup: `var $ptr = ${ptr};`,
            expression: `new ${typed_name}Array($memory.buffer, $ptr + 4, $GetUint32($ptr))`
        };
    } else if (type.element_type.classification === "struct") {
        return {
            setup: `var $ptr = ${ptr};`,
            expression: type.element_type.is_ref
                ? `Array.from(new Uint32Array($memory.buffer, $ptr + 4, $GetUint32($ptr)), ($el) => new ${type.element_type.name}($el))`
                : `Array.from({ length: $GetUint32($ptr) }, (_, i) => new ${type.element_type.name}($ptr + 4 + i * ${type.element_type.sizeof}))`
        };
    } else if (type.element_type.classification === "array") {
        throw new Error("Nested arrays are not supported");
    } else if (type.element_type.classification === "function") {
        return {
            setup: `var $ptr = ${ptr};`,
            expression: `Array.from({ length: $GetUint32($ptr) }, (_, i) => ${functionToJavascript("$ptr + 4 + i * 4", type.element_type).expression})`
        };
    } else if (type.element_type.classification === "string") {
        return {
            setup: `var $ptr = ${ptr};`,
            expression: `Array.from(new Uint32Array($memory.buffer, $ptr + 4, $GetUint32($ptr)), ($el) => ${stringToJavascript("$el", type.element_type).expression})`
        };
    } else {
        // @ts-expect-error unreachable probably
        throw new Error(`Unknown type: ${type.element_type.classification}`);
    }
}

function functionToJavascript(ptr: string, _type: FunctionTypeInformation): Conversion {
    return { expression: `$toJavascriptFunction(${ptr})` };
}

function stringToJavascript(ptr: string, _type: StringTypeInformation): Conversion {
    return { expression: `$toJavascriptString(${ptr})` };
}

function isPrimitiveFunction(type: FunctionTypeInformation) {
    return (
        type.implementation.results.classification === "primitive" &&
        type.implementation.params.every((x) => x.type.classification === "primitive")
    );
}

function functionDeclarationToType(ctx: JSContext, func: FunctionDeclaration) {
    return {
        classification: "function",
        name: func.id.name,
        implementation: {
            params: func.params.map((x) => ({
                name: x.name.name,
                type: parseType(ctx, x.typeAnnotation)
            })),
            results: parseType(ctx, func.returnType)
        },
        sizeof: 0
    } satisfies FunctionTypeInformation;
}
