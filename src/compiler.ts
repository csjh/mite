import { tokenize } from "./frontend/tokenizer.js";
import { Parser } from "./frontend/parser.js";
import { programToModule } from "./backend/code_generation.js";
import binaryen from "binaryen";
import { programToBoilerplate } from "./backend/boilerplate_generation.js";

type CompileOptions =
    | {
          as?: "wasm" | "wat";
          optimize?: boolean;
      }
    | {
          as: "boilerplate";
          filename: string;
      };

export function compile(source: string, options: { as: "boilerplate"; filename: string }): string;
export function compile(source: string, options: CompileOptions & { as: "wat" }): string;
export function compile(source: string, options?: CompileOptions): Uint8Array;
export function compile(source: string, options: CompileOptions = {}): string | Uint8Array {
    options.as ??= "wasm";

    const tokens = tokenize(source);
    const program = Parser.parse(tokens);

    if (options.as === "boilerplate") {
        return programToBoilerplate(program, options.filename);
    }

    const mod = programToModule(program);

    mod.setFeatures(
        binaryen.Features.BulkMemory |
            binaryen.Features.MutableGlobals |
            binaryen.Features.NontrappingFPToInt |
            binaryen.Features.SIMD128 |
            binaryen.Features.ReferenceTypes
    );
    // this might be icky
    mod.autoDrop();

    // the mite standard library
    for (const type of ["i32", "i64", "f32", "f64"]) {
        // @ts-ignore
        mod.addFunctionImport(`log_${type}`, "console", "log", binaryen[type], binaryen.none);
    }

    mod.validate();

    if (options.optimize) {
        binaryen.setOptimizeLevel(3);
        binaryen.setShrinkLevel(3);
        binaryen.setLowMemoryUnused(true);
        mod.optimize();
    }

    if (options.as === "wat") {
        return mod.emitText();
    } else if (options.as === "wasm") {
        return mod.emitBinary();
    }

    throw new Error(`Unknown output format: ${options.as}`);
}
