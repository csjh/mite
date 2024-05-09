import { Context, TypeInformation } from "../types/code_gen.js";
import { ExportNamedDeclaration, FunctionDeclaration, Program } from "../types/nodes.js";
import { identifyStructs } from "../backend/context_initialization.js";
import { Primitive } from "../backend/type_classes.js";
import { parseType } from "../backend/utils.js";
import dedent from "dedent";

export type Options = {};

export function programToBoilerplate(program: Program, options: Options) {
    const structs = identifyStructs(program);
    const ctx = {
        types: Object.fromEntries([
            ...Primitive.primitives.entries(),
            ...structs.map((x) => [x.name, x])
        ])
    } as Context;
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

    for (const struct of structs) {
        if (struct.classification !== "struct") continue;

        code += dedent`
            declare class ${struct.name} {
                static sizeof: number;
                ${Array.from(struct.fields.entries(), ([name, info]) => {
                    return `
                get ${name}(): ${info.type.name};
                set ${name}(val: ${info.type.name});`;
                }).join("\n")}
            }
        `;

        code += "\n\n";
    }

    for (const func of exports) {
        const { id, params, returnType } = func;
        const returnTypeType = parseType(ctx, returnType);

        code += dedent`
            export declare function ${id.name}(${params
                .map((x) => `${x.name.name}: ${typeToIdentifier(parseType(ctx, x.typeAnnotation))}`)
                .join(", ")}): ${typeToIdentifier(returnTypeType)};
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
        return `(${type.implementation.params.map((x, i) => `$${i}: ${typeToIdentifier(x)}`).join(", ")}) => ${typeToIdentifier(
            type.implementation.results
        )}`;
    }

    // @ts-expect-error
    type.classification;
    throw Error("Unknown type classification in typeToIdentifier");
}
