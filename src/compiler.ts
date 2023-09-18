import { tokenize } from "./frontend/tokenizer.js";
import { Parser } from "./frontend/parser.js";
import { programToModule } from "./backend/code_generation.js";
import binaryen from "binaryen";

type CompileOptions = {
    as?: "wat" | "wasm";
};

export function compile(source: string, options: CompileOptions & { as: "wat" }): string;
export function compile(source: string, options?: CompileOptions): Uint8Array;
export function compile(source: string, options: CompileOptions = {}): string | Uint8Array {
    options.as ??= "wasm";

    const tokens = tokenize(source);
    const program = Parser.parse(tokens);
    const mod = programToModule(program);

    mod.addFunctionImport("log_i32", "console", "log", binaryen.i32, binaryen.none);
    mod.addFunctionImport("log_i64", "console", "log", binaryen.i64, binaryen.none);
    mod.addFunctionImport("log_f32", "console", "log", binaryen.f32, binaryen.none);
    mod.addFunctionImport("log_f64", "console", "log", binaryen.f64, binaryen.none);

    if (options.as === "wat") {
        return mod.emitText();
    } else if (options.as === "wasm") {
        return mod.emitBinary();
    }

    throw new Error(`Unknown output format: ${options.as}`);
}

import fs from "fs/promises";
import { fileURLToPath } from "url";

// only run if directly called
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const program = await fs.readFile(process.argv[2], "utf8");

    const output = compile(program);

    console.log(compile(program, { as: "wat" }));

    const compiled = new WebAssembly.Module(output);
    // @ts-ignore
    const instance = new WebAssembly.Instance(compiled, { console });

    // @ts-ignore
    console.log(instance.exports.main());
}
