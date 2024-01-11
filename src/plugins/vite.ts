import type { Plugin } from "vite";
import { compile } from "../compiler.js";
import path from "path";

export function mite(): Plugin {
    return {
        name: "vite-plugin-mite",
        transform(code, id) {
            if (id.endsWith(".mite")) {
                const file = this.emitFile({
                    type: "asset",
                    fileName: `${path.basename(id)}.wasm`,
                    source: compile(code, { optimize: true })
                });

                const boilerplate = compile(code, {
                    as: "boilerplate",
                    filename: file
                });

                return boilerplate;
            }
        }
    };
}
