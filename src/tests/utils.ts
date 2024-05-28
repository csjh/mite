import { writeFileSync } from "node:fs";
import { compile } from "../compiler.js";
import assert from "node:assert";

export async function compileAndRun(
    program: string,
    expected_output: string[] | number | bigint | "error",
    func: string = "main"
) {
    const compiled = await compile(program, {
        resolveImport: async () => ({
            isMite: false,
            absolute: "",
            code: ""
        })
    });
    // console.log(compile(program, { as: "wat" }));

    const module = new WebAssembly.Module(compiled);

    writeFileSync("out.wasm", compiled);

    const string_array_output: string[] = [];
    const instance = new WebAssembly.Instance(module, {
        console: {
            log: (x: number) => string_array_output.push(String(x))
        },
        $mite: {
            $memory: new WebAssembly.Memory({ initial: 256 }),
            $table: new WebAssembly.Table({ initial: 64, element: "anyfunc" }),
            $heap_pointer: new WebAssembly.Global({ value: "i32", mutable: false }, 0),
            $heap_offset: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
            $fn_ptrs_start: new WebAssembly.Global({ value: "i32", mutable: false }, 0),
            $update_dataview: () => {}
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
