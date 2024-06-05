import fs from "fs/promises";
import { compile } from "./compiler.js";

const program = await fs.readFile(process.argv[2], "utf8");

console.log(
    await compile(program, {
        as: "wat",
        optimize: false,
        resolveImport() {
            return Promise.resolve({
                isMite: false,
                absolute: "",
                code: ""
            });
        }
    })
);
console.log(
    await compile(program, {
        as: "javascript",
        createInstance(imports) {
            return {
                instantiation: `WebAssembly.instantiate(Uint8Array.from(atob("atea"), (c) => c.charCodeAt(0)), ${imports})`
            };
        }
    })
);
console.log(await compile(program, { as: "dts" }));

const output = await compile(program, {
    resolveImport() {
        return Promise.resolve({
            isMite: false,
            absolute: "",
            code: ""
        });
    }
});

await fs.writeFile("out.wasm", output);

const compiled = new WebAssembly.Module(output);

// prettier-ignore
const instance = new WebAssembly.Instance(compiled, {
    // @ts-expect-error this works
    console,
    $mite: new Proxy({
        $memory: new WebAssembly.Memory({ initial: 256 }),
        $table: new WebAssembly.Table({ initial: 0, element: "anyfunc" }),
        $heap_pointer: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
        $heap_offset: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
        $fn_ptrs_start: new WebAssembly.Global({ value: "i32" }, 0),
        $update_dataview: () => {}
    }, {
        get(target, prop) {
            // @ts-expect-error this works
            if (prop.startsWith("wrap_")) { return function (ptr, ...args) { return $funcs[ptr](...args); }; }
            return Reflect.get(target, prop);
        }
    })
});

// @ts-expect-error this works
console.log(instance.exports.main());
