import { tokenize } from "./frontend/tokenizer.js";
import { Parser } from "./frontend/parser.js";
import { program_to_module } from "./backend/code_generation.js";

type CompileOptions = {
    as?: "wat" | "wasm";
};

export function compile(source: string, options: CompileOptions & { as: "wat" }): string;
export function compile(source: string, options?: CompileOptions): Uint8Array;
export function compile(source: string, options: CompileOptions = {}): string | Uint8Array {
    options.as ??= "wasm";

    const tokens = tokenize(source);
    const program = Parser.parse(tokens);
    const mod = program_to_module(program);

    if (options.as === "wat") {
        return mod.emitText();
    } else if (options.as === "wasm") {
        return mod.emitBinary();
    }

    throw new Error(`Unknown output format: ${options.as}`);
}

import fs from "fs/promises";

const program = await fs.readFile(process.argv[2], "utf8");

const output = compile(program);

console.log(compile(program, { as: 'wat' }));

const compiled = new WebAssembly.Module(output);
const instance = new WebAssembly.Instance(compiled, {});

// @ts-ignore
console.log(instance.exports.main());
