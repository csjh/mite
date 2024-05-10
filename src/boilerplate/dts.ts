import { Context, InstanceStructTypeInformation, TypeInformation } from "../types/code_gen.js";
import {
    ExportNamedDeclaration,
    FunctionDeclaration,
    Program,
    StructDeclaration
} from "../types/nodes.js";
import { identifyStructs } from "../backend/context_initialization.js";
import { Primitive } from "../backend/type_classes.js";
import { parseType } from "../backend/utils.js";
import dedent from "dedent";

export type Options = unknown;

export function programToBoilerplate(program: Program, _: Options) {
    const structs = identifyStructs(program);
    const ctx = {
        types: Object.fromEntries([
            ...Primitive.primitives.entries(),
            ...structs.map((x) => [x.name, x])
        ])
    } as Context;

    for (const struct of program.body.filter(
        (x): x is StructDeclaration => x.type === "StructDeclaration"
    )) {
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
                }
            });
        }
    }

    const exports = program.body
        .filter(
            (x): x is ExportNamedDeclaration =>
                x.type === "ExportNamedDeclaration" && x.declaration.type === "FunctionDeclaration"
        )
        .map((x) => x.declaration as FunctionDeclaration);

    let code = dedent`
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

    for (const { name, fields, methods } of structs) {
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

    for (const { id, params, returnType } of exports) {
        code += dedent`
            export declare function ${id.name}(${params
                .map((x) => `${x.name.name}: ${typeToIdentifier(parseType(ctx, x.typeAnnotation))}`)
                .join(", ")}): ${typeToIdentifier(parseType(ctx, returnType))};
        `;

        code += "\n\n";
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
    }

    // @ts-expect-error unreachable probably
    type.classification;
    throw Error("Unknown type classification in typeToIdentifier");
}
