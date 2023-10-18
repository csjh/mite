import fs from "fs/promises";
import { compile } from "./compiler.js";

const program = await fs.readFile(process.argv[2], "utf8");

const output = compile(program);

console.log(compile(program, { as: "wat" }));

const compiled = new WebAssembly.Module(output);
// @ts-ignore
const instance = new WebAssembly.Instance(compiled, { console });

// @ts-ignore
console.log(instance.exports.main());
