import { writeFileSync } from "node:fs";
import { compile } from "../compiler.js";
import assert from "node:assert";
import type {
    AssignmentExpression,
    SequenceExpression,
    VariableDeclaration,
    SimpleLiteral,
    VariableDeclarator,
    Identifier,
    Node
} from "estree";
import { parse } from "acorn";
import { print } from "esrap";

export async function compileAndRun(
    program: string,
    expected_output: string[] | number | bigint | "error",
    func: string = "main"
) {
    const compiled = await compile(program, {
        resolveImport: async () => ({
            isMite: false,
            absolute: "",
            code: ""
        })
    });
    // console.log(compile(program, { as: "wat" }));

    const module = new WebAssembly.Module(compiled);

    writeFileSync("out.wasm", compiled);

    const string_array_output: string[] = [];
    const instance = new WebAssembly.Instance(module, {
        console: {
            log: (x: number) => string_array_output.push(String(x))
        },
        $mite: {
            $memory: new WebAssembly.Memory({ initial: 256 }),
            $table: new WebAssembly.Table({ initial: 64, element: "anyfunc" }),
            $heap_pointer: new WebAssembly.Global({ value: "i32", mutable: false }, 0),
            $heap_offset: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
            $fn_ptrs_start: new WebAssembly.Global({ value: "i32", mutable: false }, 0),
            $update_dataview: () => {}
        }
    });

    if (expected_output === "error") {
        // @ts-expect-error wasm exports
        assert.throws(() => instance.exports[func]());
        return;
    }

    // @ts-expect-error wasm exports
    const number = instance.exports[func]();

    if (typeof expected_output === "number" || typeof expected_output === "bigint") {
        assert.strictEqual(number, expected_output);
    } else {
        assert.deepStrictEqual(string_array_output, expected_output);
    }
}

function adaptImportsExports(source: string): string {
    const s = { start: 0, end: 0 };

    const ast = parse(source, { sourceType: "module", ecmaVersion: "latest" });
    // const $$exports = {};
    ast.body.unshift({
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: { type: "Identifier", name: "$$exports", ...s },
                init: { type: "ObjectExpression", properties: [], ...s },
                ...s
            }
        ],
        kind: "const",
        ...s
    });

    // @ts-expect-error annoying mismatch between estree and acorn
    ast.body = ast.body.flatMap((node) => {
        if (node.type === "ImportDeclaration") {
            // import { imported as local } from "some-module"
            // var { imported: local } = $$imports["some-module"]

            const new_node_declaration = {
                type: "VariableDeclarator",
                id: {
                    type: "ObjectPattern",
                    properties: node.specifiers
                        .filter((x) => x.type === "ImportSpecifier")
                        .map((specifier) => ({
                            type: "Property",
                            method: false,
                            shorthand: true,
                            computed: false,
                            key: specifier.imported as Identifier,
                            kind: "init",
                            value: specifier.local
                        }))
                },
                init: {
                    type: "MemberExpression",
                    object: {
                        type: "Identifier",
                        name: "$$imports"
                    },
                    property: node.source as SimpleLiteral,
                    computed: true,
                    optional: false
                }
            } satisfies VariableDeclarator;

            return {
                type: "VariableDeclaration",
                kind: "var",
                declarations: [new_node_declaration]
            } satisfies VariableDeclaration;
        } else if (node.type === "ExportNamedDeclaration") {
            // export function exported() {};
            // function exported() {}; $$exports.exported = exported;

            if (node.declaration?.type === "VariableDeclaration") {
                return [
                    node.declaration,
                    {
                        type: "SequenceExpression",
                        expressions: node.declaration.declarations.map((declaration) => ({
                            type: "AssignmentExpression",
                            operator: "=",
                            left: {
                                type: "MemberExpression",
                                object: {
                                    type: "Identifier",
                                    name: "$$exports"
                                },
                                property: declaration.id as Identifier,
                                computed: false,
                                optional: false
                            },
                            right: declaration.id as Identifier
                        }))
                    } satisfies SequenceExpression
                ];
            } else if (node.declaration) {
                return [
                    node.declaration,
                    {
                        type: "AssignmentExpression",
                        operator: "=",
                        left: {
                            type: "MemberExpression",
                            object: {
                                type: "Identifier",
                                name: "$$exports"
                            },
                            property: node.declaration.id,
                            computed: false,
                            optional: false
                        },
                        right: node.declaration.id
                    } satisfies AssignmentExpression
                ];
            } else {
                return {
                    type: "SequenceExpression",
                    expressions: node.specifiers.map((specifier) => ({
                        type: "AssignmentExpression",
                        operator: "=",
                        left: {
                            type: "MemberExpression",
                            object: {
                                type: "Identifier",
                                name: "$$exports"
                            },
                            property: specifier.exported as SimpleLiteral,
                            computed: false,
                            optional: false
                        },
                        right: specifier.exported as Identifier
                    }))
                } satisfies SequenceExpression;
            }
        } else {
            return node;
        }
    });

    ast.body.push({
        type: "ReturnStatement",
        argument: {
            type: "Identifier",
            name: "$$exports",
            ...s
        },
        ...s
    });

    return print(ast as unknown as Node).code;
}

const AsyncFunction = async function () {}.constructor as FunctionConstructor;
export function getModule(
    source: string,
    imports: Record<string, Record<string, unknown>> = {}
): Promise<Record<string, unknown>> {
    const adapted_for_function = adaptImportsExports(source);
    console.log(adapted_for_function);
    return new AsyncFunction("$$imports", adapted_for_function)(imports);
}
