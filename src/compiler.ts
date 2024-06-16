import { tokenize } from "./frontend/tokenizer.js";
import { Parser } from "./frontend/parser.js";
import { programToModule } from "./backend/code_generation.js";
import binaryen from "binaryen";
import { programToBoilerplate as toJavascript } from "./boilerplate/javascript.js";
import { programToBoilerplate as toDts } from "./boilerplate/dts.js";

type CompileOptions =
    | ({
          as?: "wasm" | "wat";
          optimize?: boolean;
      } & import("./backend/code_generation.js").Options)
    | ({ as: "javascript" } & import("./boilerplate/javascript.js").Options)
    | ({ as: "dts" } & import("./boilerplate/dts.js").Options);

export async function compile(
    source: string,
    options: CompileOptions & { as: "javascript" }
): Promise<string>;
export async function compile(
    source: string,
    options: CompileOptions & { as: "wat" }
): Promise<string>;
export async function compile(
    source: string,
    options: CompileOptions & { as: "wat" }
): Promise<string>;
export async function compile(source: string, options: CompileOptions): Promise<Uint8Array>;
export async function compile(
    source: string,
    options: CompileOptions
): Promise<string | Uint8Array> {
    options.as ??= "wasm";

    const tokens = tokenize(source);
    const program = Parser.parse(tokens);

    if (options.as === "javascript") {
        return toJavascript(program, options);
    }

    if (options.as === "dts") {
        return toDts(program, options);
    }

    const mod = await programToModule(program, options);

    mod.setFeatures(
        binaryen.Features.BulkMemory |
            binaryen.Features.MutableGlobals |
            binaryen.Features.NontrappingFPToInt |
            binaryen.Features.SIMD128 |
            binaryen.Features.ReferenceTypes |
            binaryen.Features.SignExt
    );
    // this might be icky
    mod.autoDrop();

    // the mite standard library
    for (const type of ["i32", "i64", "f32", "f64"]) {
        // @ts-expect-error binaryen types
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
