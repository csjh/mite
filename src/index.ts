import binaryen from "binaryen";
import { writeFileSync } from "fs";

const myModule = new binaryen.Module();
myModule.setFeatures(binaryen.Features.All);

myModule.addFunction(
    "main",
    binaryen.createType([]),
    binaryen.i64,
    [],
    myModule.block(null, [
        myModule.return(
            myModule.i64.const(
                0b00000000000000000000000000000000,
                0b10000000000000000000000000000000
            )
        )
    ])
);

myModule.addFunctionExport("main", "main");

console.log(myModule.emitText());
writeFileSync("out.wasm", myModule.emitBinary());

// Optimize the module using default passes and levels
myModule.optimize();

// Validate the module
if (!myModule.validate()) throw new Error("validation error");

// Generate text format and binary
const wasmData = myModule.emitBinary();

// Example usage with the WebAssembly API
const compiled = new WebAssembly.Module(wasmData);
const instance = new WebAssembly.Instance(compiled, {});

// @ts-ignore
console.log(instance.exports.main());
