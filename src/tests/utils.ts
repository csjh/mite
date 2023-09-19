import { writeFileSync } from "node:fs";
import { compile } from "../compiler.js";
import assert from "node:assert";

export function compileAndRun(
    program: string,
    expected_output: string[] | number,
    func: string = "main"
) {
    const compiled = compile(program);
    console.log(compile(program, { as: "wat" }));

    const module = new WebAssembly.Module(compiled);

    writeFileSync("out.wasm", compiled);

    const string_array_output: string[] = [];
    const instance = new WebAssembly.Instance(module, {
        console: {
            log: (x: number) => string_array_output.push(String(x))
        }
    });

    // @ts-expect-error
    const number = instance.exports[func]();

    if (typeof expected_output === "number") {
        assert.strictEqual(number, expected_output);
    } else {
        assert.deepStrictEqual(string_array_output, expected_output);
    }
}
