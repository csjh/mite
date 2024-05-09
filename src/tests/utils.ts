import { writeFileSync } from "node:fs";
import { compile } from "../compiler.js";
import assert from "node:assert";

export function compileAndRun(
    program: string,
    expected_output: string[] | number | bigint | "error",
    func: string = "main"
) {
    const compiled = compile(program);
    // console.log(compile(program, { as: "wat" }));

    const module = new WebAssembly.Module(compiled);

    writeFileSync("out.wasm", compiled);

    const string_array_output: string[] = [];
    const instance = new WebAssembly.Instance(module, {
        console: {
            log: (x: number) => string_array_output.push(String(x))
        }
    });

    if (expected_output === "error") {
        // @ts-expect-error wasm exports
        assert.throws(() => instance.exports[func]());
        return;
    }

    // @ts-expect-error wasm exports
    const number = instance.exports[func]();

    if (typeof expected_output === "number" || typeof expected_output === "bigint") {
        assert.strictEqual(number, expected_output);
    } else {
        assert.deepStrictEqual(string_array_output, expected_output);
    }
}
