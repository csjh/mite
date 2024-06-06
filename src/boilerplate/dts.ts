import {
    Context,
    InstanceStructTypeInformation,
    StructTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import {
    ExportNamedDeclaration,
    FunctionDeclaration,
    ImportDeclaration,
    Program,
    StructDeclaration,
    VariableDeclaration
} from "../types/nodes.js";
import { buildTypes } from "../backend/context_initialization.js";
import { assumeStructs, parseType } from "../backend/utils.js";
import dedent from "dedent";

export type Options = unknown;

export function programToBoilerplate(program: Program, _: Options) {
    const ctx = {
        types: assumeStructs(buildTypes(program))
    } as Context;

    const imports = program.body.filter(
        (x): x is ImportDeclaration => x.type === "ImportDeclaration"
    );

    for (const import_ of imports) {
        for (const specifier of import_.specifiers) {
            // @ts-expect-error filler type
            ctx.types[specifier.local.name] = {
                classification: "struct",
                name: specifier.local.name
            };
        }
    }

    for (const struct of program.body
        .map((x) => (x.type === "ExportNamedDeclaration" ? x.declaration : x))
        .filter((x): x is StructDeclaration => x.type === "StructDeclaration")) {
        for (const { id, params, returnType } of struct.methods) {
            (ctx.types[struct.id.name] as InstanceStructTypeInformation).methods.set(id.name, {
                classification: "function",
                name: `${struct.id.name}.${id.name}`,
                sizeof: 0,
                implementation: {
                    params: params.map(({ name, typeAnnotation }) => ({
                        name: name.name,
                        type: parseType(ctx, typeAnnotation)
                    })),
                    results: parseType(ctx, returnType)
                },
                is_ref: false
            });
        }
    }

    const export_declarations = program.body
        .filter((x): x is ExportNamedDeclaration => x.type === "ExportNamedDeclaration")
        .map((x) => x.declaration);
    const var_exports = export_declarations.filter(
        (x): x is VariableDeclaration => x.type === "VariableDeclaration"
    );

    const function_exports = export_declarations.filter(
        (x): x is FunctionDeclaration => x.type === "FunctionDeclaration"
    );

    let code = dedent`
        ${imports.map((x) => `import { ${x.specifiers.map((x) => (x.local.name !== x.imported.name ? `${x.imported.name} as ${x.local.name}` : x.imported.name)).join(", ")} } from "${x.source.value}";`).join("\n")}

        declare type bool = boolean;
        declare type i8 = number;
        declare type i16 = number;
        declare type i32 = number;
        declare type i64 = bigint;
        declare type u8 = number;
        declare type u16 = number;
        declare type u32 = number;
        declare type u64 = bigint;
        declare type f32 = number;
        declare type f64 = number;
        declare type v128 = never;
    `;

    code += "\n\n";

    for (const { name, fields, methods } of Object.values(ctx.types).filter(
        (x): x is StructTypeInformation => x.classification === "struct" && "sizeof" in x // catch filler imported structs
    )) {
        code += dedent`
            declare class ${name} {
                static sizeof: number;${Array.from(fields.entries(), ([name, info]) => {
                    return `\n
                get ${name}(): ${typeToIdentifier(info.type)};
                set ${name}(val: ${typeToIdentifier(info.type)});`;
                }).join("")}${Array.from(
                    methods.entries(),
                    // prettier-ignore
                    ([name, { implementation: { params, results } }]) => {
                        return `\n
                ${name}(${params.slice(1).map((x) => `${x.name}: ${typeToIdentifier(x.type)}`).join(", ")}): ${typeToIdentifier(results)};`;
                    }
                ).join("")}
            }
        `;

        code += "\n\n";
    }

    for (const { id, params, returnType } of function_exports) {
        code += dedent`
            export declare function ${id.name}(${params
                .map((x) => `${x.name.name}: ${typeToIdentifier(parseType(ctx, x.typeAnnotation))}`)
                .join(", ")}): ${typeToIdentifier(parseType(ctx, returnType))};
        `;

        code += "\n\n";
    }

    for (const { declarations } of var_exports) {
        for (const { id, typeAnnotation } of declarations) {
            code += dedent`
                export declare const ${id.name}: ${typeToIdentifier(parseType(ctx, typeAnnotation))};
            `;

            code += "\n\n";
        }
    }

    // remove second trailing newline
    return code.slice(0, -1);
}

function typeToIdentifier(type: TypeInformation): string {
    if (type.classification === "primitive" || type.classification === "struct") {
        return type.name;
    } else if (type.classification === "array") {
        return `${type.name.slice(1, type.name.indexOf(";"))}[]`;
    } else if (type.classification === "function") {
        return `(${type.implementation.params.map((x) => `${x.name}: ${typeToIdentifier(x.type)}`).join(", ")}) => ${typeToIdentifier(
            type.implementation.results
        )}`;
    } else if (type.classification === "string") {
        return "string";
    }

    // @ts-expect-error unreachable probably
    type.classification;
    throw Error("Unknown type classification in typeToIdentifier");
}
