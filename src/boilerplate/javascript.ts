import {
    ArrayTypeInformation,
    Context,
    FunctionTypeInformation,
    PrimitiveTypeInformation,
    StringTypeInformation,
    StructTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import {
    ExportNamedDeclaration,
    FunctionDeclaration,
    Program,
    StructDeclaration
} from "../types/nodes.js";
import { identifyStructs } from "../backend/context_initialization.js";
import { Primitive, String_ } from "../backend/type_classes.js";
import { parseType } from "../backend/utils.js";
import dedent from "dedent";

interface Accessors {
    getter: string;
    setter: string;
}

interface Conversion {
    setup?: string;
    expression: string;
}

type Capitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : S;

type DataViewGetterTypes =
    Extract<keyof DataView, `get${string}`> extends `get${infer T}` ? Capitalize<T> : never;

export type Options = {
    createInstance(imports: string): { instantiation: string; setup?: string };
};

export function programToBoilerplate(program: Program, { createInstance }: Options) {
    const structs = identifyStructs(program);
    const ctx = {
        types: Object.fromEntries([
            ...Primitive.primitives.entries(),
            ...structs.map((x) => [x.name, x]),
            ["string", String_.type]
        ])
    } as Context;
    const exports = program.body
        .filter(
            (x): x is ExportNamedDeclaration =>
                x.type === "ExportNamedDeclaration" && x.declaration.type === "FunctionDeclaration"
        )
        .map((x) => x.declaration as FunctionDeclaration);
    const methods = Object.fromEntries(
        program.body
            .filter((x): x is StructDeclaration => x.type === "StructDeclaration")
            .map((x) => [x.id.name, x.methods])
    );

    const { setup = "", instantiation } = createInstance("{ console }");

    let code = dedent`
        ${setup ? setup + "\n" : ""}
        const $wasm = await ${instantiation};
        const { $memory, $table, $arena_heap_malloc, $noop, ${exports
            .map((x) => `${x.id.name}: $wasm_export_${x.id.name}, `)
            .join("")}} = $wasm.instance.exports;
        const $buffer = new DataView($memory.buffer);

        const $virtualized_functions =  /*#__PURE__*/ Array.from($table, (_, i) => $table.get(i));
        const $TableSet = /*#__PURE__*/ $table.set.bind($table);

        const $encoder = /*#__PURE__*/ new TextEncoder();
        const $decoder = /*#__PURE__*/ new TextDecoder();
        const $stringToPointer = /*#__PURE__*/ new Map();
        const $pointerToString = /*#__PURE__*/ new Map();

        const $DataViewPrototype = DataView.prototype;
        const $GetBigInt64 =  /*#__PURE__*/ $DataViewPrototype.getBigInt64 .bind($buffer);
        const $GetBigUint64 = /*#__PURE__*/ $DataViewPrototype.getBigUint64.bind($buffer);
        const $GetFloat32 =   /*#__PURE__*/ $DataViewPrototype.getFloat32  .bind($buffer);
        const $GetFloat64 =   /*#__PURE__*/ $DataViewPrototype.getFloat64  .bind($buffer);
        const $GetInt16 =     /*#__PURE__*/ $DataViewPrototype.getInt16    .bind($buffer);
        const $GetInt32 =     /*#__PURE__*/ $DataViewPrototype.getInt32    .bind($buffer);
        const $GetInt8 =      /*#__PURE__*/ $DataViewPrototype.getInt8     .bind($buffer);
        const $GetUint16 =    /*#__PURE__*/ $DataViewPrototype.getUint16   .bind($buffer);
        const $GetUint32 =    /*#__PURE__*/ $DataViewPrototype.getUint32   .bind($buffer);
        const $GetUint8 =     /*#__PURE__*/ $DataViewPrototype.getUint8    .bind($buffer);
        const $SetBigInt64 =  /*#__PURE__*/ $DataViewPrototype.setBigInt64 .bind($buffer);
        const $SetBigUint64 = /*#__PURE__*/ $DataViewPrototype.setBigUint64.bind($buffer);
        const $SetFloat32 =   /*#__PURE__*/ $DataViewPrototype.setFloat32  .bind($buffer);
        const $SetFloat64 =   /*#__PURE__*/ $DataViewPrototype.setFloat64  .bind($buffer);
        const $SetInt16 =     /*#__PURE__*/ $DataViewPrototype.setInt16    .bind($buffer);
        const $SetInt32 =     /*#__PURE__*/ $DataViewPrototype.setInt32    .bind($buffer);
        const $SetInt8 =      /*#__PURE__*/ $DataViewPrototype.setInt8     .bind($buffer);
        const $SetUint16 =    /*#__PURE__*/ $DataViewPrototype.setUint16   .bind($buffer);
        const $SetUint32 =    /*#__PURE__*/ $DataViewPrototype.setUint32   .bind($buffer);
        const $SetUint8 =     /*#__PURE__*/ $DataViewPrototype.setUint8    .bind($buffer);
        ${/* function bindings actually don't really care about types */ ""}
        function $toJavascriptFunction($ptr) {
            const $fn = $virtualized_functions[$GetUint32($ptr, true)].bind(null, $GetUint32($ptr + 4, true));
            $fn._ = $ptr;
            return $fn;
        }

        function $toJavascriptString($ptr) {
            if ($pointerToString.has($ptr)) return $pointerToString.get($ptr);

            const $str = $decoder.decode(new Uint8Array($memory.buffer, $ptr + 4, $GetUint32($ptr, true)));

            $pointerToString.set($ptr, $str);
            $stringToPointer.set($str, $ptr);

            return $str;
        }
        ${/* Courtesy of emscripten */ ""}
        function $utf8Length($str) {
            var $len = 0;
            for (var $i = 0; $i < $str.length; ++$i) {
                var $c = $str.charCodeAt($i);
                if ($c <= 127) {
                    ++$len;
                } else if ($c <= 2047) {
                    $len += 2;
                } else if ($c >= 55296 && $c <= 57343) {
                    $len += 4;
                    ++$i;
                } else {
                    $len += 3;
                }
            }
            return $len;
        }

        function $fromJavascriptString($str) {
            if ($stringToPointer.has($str)) return $stringToPointer.get($str);

            const $len = $utf8Length($str);
            const $ptr = $arena_heap_malloc(4 + $len);
            $SetUint32($ptr, $len, true);

            const $output = new Uint8Array($memory.buffer, $ptr + 4, $len);
            $encoder.encodeInto($str, $output);

            $pointerToString.set($ptr, $str);
            $stringToPointer.set($str, $ptr);

            return $ptr;
        }
    `;

    code += "\n\n";

    for (const { sizeof, fields, name } of structs) {
        code += dedent`
            class ${name} {
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
                ${functionDeclarationToString(ctx, fn, 16)}`;
                    })
                    .join("")}
            }
        `;

        code += "\n\n";
    }

    for (const func of exports) {
        code += `export function ${functionDeclarationToString(ctx, func, 0)}`;

        code += "\n\n";
    }

    // remove second trailing newline
    return code.slice(0, -1);
}

type ValueOf<T> = T extends Map<unknown, infer V> ? V : never;

function typeToAccessors({ type, offset }: ValueOf<StructTypeInformation["fields"]>): Accessors {
    const ptr = type.is_ref ? `$GetUint32(this._ + ${offset}, true)` : `this._ + ${offset}`;

    if (type.classification === "primitive") {
        if (type.name === "void") return { getter: "return undefined", setter: "" };
        if (type.name === "bool") {
            return {
                getter: `return !!$GetInt32(${ptr}, true);`,
                setter: `$SetInt32(${ptr}, !!$val, true);`
            };
        }

        const typed_name = primitiveToTypedName(type.name);
        return {
            getter: `return $Get${typed_name}(${ptr}, true);`,
            setter: `$Set${typed_name}(${ptr}, $val, true);`
        };
    } else if (type.classification === "struct") {
        // TODO: handle non-ref setters
        const getter = structToJavascript(ptr, type);
        return {
            getter: `${getter.setup}; return ${getter.expression};`,
            setter: type.is_ref ? `$SetUint32(${ptr}, $val._, true);` : ""
        };
    } else if (type.classification === "array") {
        // TODO: handle non-ref setters
        const getter = arrayToJavascript(ptr, type);
        return {
            getter: `${getter.setup}; return ${getter.expression};`,
            setter: type.is_ref ? `$SetUint32(${ptr}, $val._, true);` : ""
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
            setter: `$SetUint32(${ptr}, $fromJavascriptString($val), true);`
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

function functionDeclarationToString(ctx: Context, func: FunctionDeclaration, indentation: number) {
    const { id, params, returnType } = func;
    if (params[0]?.name.name === "this") params.shift();
    const returnTypeType = parseType(ctx, returnType);

    const args = params.map((x) => javascriptToMite(x.name.name, parseType(ctx, x.typeAnnotation)));
    const args_setup = args
        .map((x) => x.setup)
        .filter(Boolean)
        .join("\n\t    ");
    const args_setup_str = args_setup ? `\n\t    ${args_setup}` : "";
    const args_expression = args.map((x) => x.expression).join(", ");

    const has_callbacks = params.some((x) => x.typeAnnotation._type.type === "Function");
    const callbacks_setup_str = has_callbacks ? `\n\t    let $fns = 0;` : "";
    const callbacks_cleanup_str = has_callbacks
        ? `\n\t    for (let $i = 0; $i < $fns; $i++) $TableSet($i, $noop);`
        : "";

    const { setup, expression } = miteToJavascript("$result", returnTypeType);
    const setup_str = setup ? `\n\t    ${setup}` : "";

    return `${id.name}(${params.map((x) => x.name.name).join(", ")}) {${args_setup_str}${callbacks_setup_str}
\t    const $result = $wasm_export_${id.name}(${args_expression});
\t${setup_str}${callbacks_cleanup_str}
\t    return ${expression};
\t}`.replaceAll("\t", " ".repeat(indentation));
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

function functionToMite(
    ptr: string,
    { implementation: { params, results } }: FunctionTypeInformation
): Conversion {
    const fn = `$mite_${ptr}`;
    const fn_result = `${fn}_result`;

    const args = params.map((x) => miteToJavascript(x.name, x.type));
    const args_setup = args
        .map((x) => x.setup)
        .filter(Boolean)
        .join("\n\t    ");
    const args_setup_str = args_setup ? `\n\t            ${args_setup}` : "";
    const args_expression = args.map((x) => x.expression).join(", ");

    const { setup, expression } = miteToJavascript(fn_result, results);
    const setup_str = setup ? `\n\t    ${setup}` : "";

    return {
        setup: `\t    let ${fn} = 0;
\t    if (Object.hasOwn(${ptr}, '_')) {
\t        ${fn} = ${ptr}._;
\t    } else {
\t        $TableSet(0, function (_${params.length ? ", " + params.map((x) => x.name).join(", ") : ""}) {${args_setup_str}
\t            const ${fn_result} = ${ptr}(${args_expression});${setup_str}
\t            return ${expression};
\t        });
\t        ${fn} = 1024 + ($fns++) * 8;
\t    }`,
        expression: fn
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
            setup: `const $ptr = ${ptr};`,
            expression: `new ${typed_name}Array($memory.buffer, $ptr + 4, $GetUint32($ptr, true))`
        };
    } else if (type.element_type.classification === "struct") {
        return {
            setup: `const $ptr = ${ptr};`,
            expression: type.element_type.is_ref
                ? `Array.from(new Uint32Array($memory.buffer, $ptr + 4, $GetUint32($ptr, true)), ($el) => new ${type.element_type.name}($el))`
                : `Array.from({ length: $GetUint32($ptr, true) }, (_, i) => new ${type.element_type.name}($ptr + 4 + i * ${type.element_type.sizeof}))`
        };
    } else if (type.element_type.classification === "array") {
        throw new Error("Nested arrays are not supported");
    } else if (type.element_type.classification === "function") {
        return {
            setup: `const $ptr = ${ptr};`,
            expression: `Array.from({ length: $GetUint32($ptr, true) }, (_, i) => ${functionToJavascript("$ptr + 4 + i * 4", type.element_type).expression})`
        };
    } else if (type.element_type.classification === "string") {
        return {
            setup: `const $ptr = ${ptr};`,
            expression: `Array.from(new Uint32Array($memory.buffer, $ptr + 4, $GetUint32($ptr, true)), ($el) => ${stringToJavascript("$el", type.element_type).expression})`
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
