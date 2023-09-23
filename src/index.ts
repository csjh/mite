import binaryen from "binaryen";
import { writeFileSync } from "fs";

const mod = new binaryen.Module();
mod.setFeatures(binaryen.Features.All);

mod.addFunction(
    "main",
    binaryen.createType([]),
    binaryen.i64,
    [],
    mod.block(null, [
        mod.return(
            mod.i64.const(0b00000000000000000000000000000000, 0b10000000000000000000000000000000)
        )
    ])
);

mod.addFunctionExport("main", "main");

// Optimize the module using default passes and levels
mod.optimize();

console.log(mod.emitText());
writeFileSync("out.wasm", mod.emitBinary());

// Validate the module
if (!mod.validate()) throw new Error("validation error");

// Generate text format and binary
const wasmData = mod.emitBinary();

// Example usage with the WebAssembly API
const compiled = new WebAssembly.Module(wasmData);
const instance = new WebAssembly.Instance(compiled, {});

// @ts-ignore
console.log(instance.exports.main());
