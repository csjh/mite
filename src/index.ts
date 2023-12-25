import fs from "fs/promises";
import { compile } from "./compiler.js";

const program = await fs.readFile(process.argv[2], "utf8");

console.log(compile(program, { as: "wat", optimize: false }));

const output = compile(program);

await fs.writeFile("out.wasm", output);

const compiled = new WebAssembly.Module(output);
// @ts-ignore
const instance = new WebAssembly.Instance(compiled, { console });

// @ts-ignore
console.log(instance.exports.main());
