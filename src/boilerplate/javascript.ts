import {
    ArrayTypeInformation,
    Context,
    StructTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import { ExportNamedDeclaration, FunctionDeclaration, Program } from "../types/nodes.js";
import { identifyStructs } from "../backend/context_initialization.js";
import { Primitive } from "../backend/type_classes.js";
import { parseType } from "../backend/utils.js";
import dedent from "dedent";

type BoilerplateOptions =
    | {
          dev: true;
          file: Uint8Array;
      }
    | {
          dev: false;
          filename: string;
      };

export function programToBoilerplate(program: Program, options: BoilerplateOptions) {
    const structs = identifyStructs(program);
    const ctx = {
        types: Object.fromEntries([
            ...Primitive.primitives.entries(),
            ...structs.map((x) => [x.name, x])
        ])
    };
    const exports = program.body
        .filter(
            (x): x is ExportNamedDeclaration =>
                x.type === "ExportNamedDeclaration" && x.declaration.type === "FunctionDeclaration"
        )
        .map((x) => x.declaration as FunctionDeclaration);

    const wasm = options.dev
        ? `await WebAssembly.instantiate(Uint8Array.from(atob("${Buffer.from(options.file).toString(
              "base64"
          )}"), (c) => c.charCodeAt(0)))`
        : `await WebAssembly.instantiateStreaming(fetch(import.meta.ROLLUP_FILE_URL_${options.filename}))`;

    let code = dedent`
        const wasm = ${wasm};
        const { ${exports
            .map((x) => `${x.id.name}: wasm_export_${x.id.name}, `)
            .join("")}memory } = wasm.instance.exports;
        const buffer = new DataView(memory.buffer);

        const DataViewPrototype = DataView.prototype;
        const GetBigInt64 =  /*#__PURE__*/ DataViewPrototype.getBigInt64.bind(buffer);
        const GetBigUint64 = /*#__PURE__*/ DataViewPrototype.getBigUint64.bind(buffer);
        const GetFloat32 =   /*#__PURE__*/ DataViewPrototype.getFloat32.bind(buffer);
        const GetFloat64 =   /*#__PURE__*/ DataViewPrototype.getFloat64.bind(buffer);
        const GetInt16 =     /*#__PURE__*/ DataViewPrototype.getInt16.bind(buffer);
        const GetInt32 =     /*#__PURE__*/ DataViewPrototype.getInt32.bind(buffer);
        const GetInt8 =      /*#__PURE__*/ DataViewPrototype.getInt8.bind(buffer);
        const GetUint16 =    /*#__PURE__*/ DataViewPrototype.getUint16.bind(buffer);
        const GetUint32 =    /*#__PURE__*/ DataViewPrototype.getUint32.bind(buffer);
        const GetUint8 =     /*#__PURE__*/ DataViewPrototype.getUint8.bind(buffer);
        const SetBigInt64 =  /*#__PURE__*/ DataViewPrototype.setBigInt64.bind(buffer);
        const SetBigUint64 = /*#__PURE__*/ DataViewPrototype.setBigUint64.bind(buffer);
        const SetFloat32 =   /*#__PURE__*/ DataViewPrototype.setFloat32.bind(buffer);
        const SetFloat64 =   /*#__PURE__*/ DataViewPrototype.setFloat64.bind(buffer);
        const SetInt16 =     /*#__PURE__*/ DataViewPrototype.setInt16.bind(buffer);
        const SetInt32 =     /*#__PURE__*/ DataViewPrototype.setInt32.bind(buffer);
        const SetInt8 =      /*#__PURE__*/ DataViewPrototype.setInt8.bind(buffer);
        const SetUint16 =    /*#__PURE__*/ DataViewPrototype.setUint16.bind(buffer);
        const SetUint32 =    /*#__PURE__*/ DataViewPrototype.setUint32.bind(buffer);
        const SetUint8 =     /*#__PURE__*/ DataViewPrototype.setUint8.bind(buffer);

        const PointerSymbol = Symbol("Pointer");
    `;

    code += "\n\n";

    for (const struct of structs) {
        if (struct.classification !== "struct") continue;

        code += dedent`
            class ${struct.name} {
                static sizeof = ${struct.sizeof};

                constructor(ptr) {
                    this[PointerSymbol] = ptr;
                }
                ${Array.from(struct.fields.entries(), ([name, info]) => {
                    const [getter, setter] = typeToAccessors(info);

                    return `
                get ${name}() {
                    ${getter}
                }

                set ${name}(val) {
                    ${setter}
                }
                `;
                }).join("")}
            }
        `;

        code += "\n\n";
    }

    for (const func of exports) {
        const { id, params, returnType } = func;
        const returnTypeType = parseType(ctx as Context, returnType);

        code += dedent`
            export function ${id.name}(${params
                .map((x) =>
                    Primitive.primitives.has(x.typeAnnotation.name)
                        ? x.name.name
                        : `{ [PointerSymbol]: ${x.name.name} }`
                )
                .join(", ")}) {
                const result = wasm_export_${id.name}(${params.map((x) => x.name.name).join(", ")});

                ${
                    returnTypeType.classification === "primitive"
                        ? "return result"
                        : returnTypeType.classification === "struct"
                        ? structToJavascript("result", returnTypeType, true)
                        : arrayToJavascript("result", returnTypeType, true)
                };
            }
        `;

        code += "\n\n";
    }

    // remove second trailing newline
    return code.slice(0, -1);
}

type ValueOf<T> = T extends Map<any, infer V> ? V : never;

function typeToAccessors({ type, offset, is_ref }: ValueOf<StructTypeInformation["fields"]>) {
    if (type.classification === "primitive") {
        switch (type.name) {
            case "void":
                return ["return undefined;", ""];
            case "bool":
                return [
                    `return !!GetInt32(this[PointerSymbol] + ${offset}, true);`,
                    `SetInt32(this[PointerSymbol] + ${offset}, !!val, true);`
                ];
            case "i8":
            case "i16":
            case "i32":
            case "i64":
            case "u8":
            case "u16":
            case "u32":
            case "u64":
            case "f32":
            case "f64":
                const typed_name = primitiveToTypedName(type.name);
                return [
                    `return Get${typed_name}(this[PointerSymbol] + ${offset}, true);`,
                    `Set${typed_name}(this[PointerSymbol] + ${offset}, val, true);`
                ];
            default:
                throw new Error(`Unknown primitive: ${type.name}`);
        }
    }

    const ptr = is_ref
        ? `GetUint32(this[PointerSymbol] + ${offset}, true)`
        : `this[PointerSymbol] + ${offset}`;

    if (type.classification === "struct") {
        return [
            structToJavascript(ptr, type, true),
            is_ref ? `SetUint32(this[PointerSymbol] + ${offset}, val[PointerSymbol], true);` : ""
        ];
    }

    if (type.classification === "array") {
        const handler = arrayToJavascript(ptr, type, true);
        if (type.element_type.classification === "primitive") {
            return [
                handler,
                is_ref
                    ? `SetUint32(this[PointerSymbol] + ${offset}, val[PointerSymbol], true);`
                    : ""
            ];
        } else if (type.element_type.classification === "struct") {
            return [handler, ""];
        } else if (type.element_type.classification === "array") {
            throw new Error("Nested arrays are not supported");
        } else {
            // @ts-expect-error unreachable probably
            throw new Error(`Unknown type: ${type.element_type.classification}`);
        }
    }

    // @ts-expect-error unreachable probably
    throw new Error(`Unknown type: ${type.classification}`);
}

function arrayToJavascript(ptr: string, type: ArrayTypeInformation, isReturn: boolean = false) {
    if (type.element_type.classification === "primitive") {
        const typed_name = primitiveToTypedName(type.element_type.name);
        return `const base = ${ptr}; ${
            isReturn ? "return" : ""
        } new ${typed_name}Array(memory.buffer, base + 4, GetUint32(base));`;
    } else if (type.element_type.classification === "struct") {
        let array;
        if (type.element_type.is_ref) {
            array = `Array.from(new Uint32Array(memory.buffer, base + 4, GetUint32(base)), (ptr) => new ${type.element_type.name}(ptr))`;
        } else {
            array = `Array.from({ length: GetUint32(base) }, (_, i) => new ${type.element_type.name}(base + 4 + i * ${type.element_type.sizeof}))`;
        }

        return `const base = ${ptr}; ${isReturn ? "return" : ""} ${array}`;
    } else if (type.element_type.classification === "array") {
        throw new Error("Nested arrays are not supported");
    } else {
        // @ts-expect-error unreachable probably
        throw new Error(`Unknown type: ${type.element_type.classification}`);
    }
}

function structToJavascript(ptr: string, type: StructTypeInformation, isReturn: boolean = false) {
    return `${isReturn ? "return" : ""} new ${type.name}(${ptr})`;
}

function primitiveToTypedName(primitive: string) {
    switch (primitive) {
        case "bool":
            return "Int32";
        case "i8":
            return "Int8";
        case "i16":
            return "Int16";
        case "i32":
            return "Int32";
        case "i64":
            return "BigInt64";
        case "u8":
            return "Uint8";
        case "u16":
            return "Uint16";
        case "u32":
            return "Uint32";
        case "u64":
            return "BigUint64";
        case "f32":
            return "Float32";
        case "f64":
            return "Float64";
        default:
            throw new Error(`Unknown primitive: ${primitive}`);
    }
}
