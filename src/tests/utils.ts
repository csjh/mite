import { readFile } from "fs/promises";
import type {
    AssignmentExpression,
    SequenceExpression,
    VariableDeclaration,
    SimpleLiteral,
    VariableDeclarator,
    Identifier,
    Node
} from "estree";
import { ImportSpecifier, parse } from "acorn";
import { print } from "esrap";
import { compile } from "../compiler.js";
import { mite_shared } from "../plugins/shared.js";

function adaptImportsExports(source: string): string {
    const s = { start: 0, end: 0 };

    const ast = parse("const $$exports = {};" + source + ";return $$exports;", {
        sourceType: "module",
        ecmaVersion: "latest",
        allowReturnOutsideFunction: true
    });

    // @ts-expect-error annoying mismatch between estree and acorn
    ast.body = ast.body.flatMap((node) => {
        if (node.type === "ImportDeclaration") {
            // import { imported as local } from "some-module"
            // becomes
            // var { imported: local } = $$imports["some-module"]

            const new_node_declaration = {
                type: "VariableDeclarator",
                id: {
                    type: "ObjectPattern",
                    properties: node.specifiers
                        .filter((x): x is ImportSpecifier => x.type === "ImportSpecifier")
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
            if (node.declaration?.type === "VariableDeclaration") {
                // export var x = 1;
                // becomes
                // var x = 1; $$exports.x = x;
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
                // export function x() {}
                // becomes
                // function x() {} $$exports.x = x;
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
                // export { x, y, z }
                // becomes
                // $$exports.x = x, $$exports.y = y, $$exports.z = z;
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

    return print(ast as unknown as Node).code;
}

const AsyncFunction = async function () {}.constructor as FunctionConstructor;
export function getModule(
    source: string,
    imports: Record<string, Record<string, unknown>> = {}
): Promise<Record<string, (...args: unknown[]) => unknown>> {
    const adapted_for_function = adaptImportsExports(source);
    return new AsyncFunction("$$imports", adapted_for_function)(imports);
}

export async function getSingleModule(
    filename: string | URL
): Promise<Record<string, (...args: unknown[]) => unknown>> {
    const source = await readFile(filename, "utf-8");

    const bytes = await compile(source, {
        as: "wasm",
        resolveImport: async (path) => ({ code: "", isMite: false, absolute: path })
    });

    const boilerplate = await compile(source, {
        as: "javascript",
        createInstance(imports) {
            return {
                instantiation: `WebAssembly.instantiate(Uint8Array.from(atob("${Buffer.from(bytes).toString("base64")}"), (c) => c.charCodeAt(0)), ${imports})`
            };
        }
    });

    return getModule(boilerplate, {
        "mite:shared": await getModule(mite_shared)
    });
}
