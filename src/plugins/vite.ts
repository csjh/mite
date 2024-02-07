import type { Plugin } from "vite";
import { compile } from "../compiler.js";
import path from "path";

const dev = process.env.NODE_ENV === "development";

export function mite(): Plugin {
    return {
        name: "vite-plugin-mite",
        transform(code, id) {
            if (!id.endsWith(".mite")) return null;

            const source = compile(code, { optimize: true });

            if (dev) {
                return compile(code, {
                    as: "boilerplate",
                    file: source,
                    dev
                });
            } else {
                const file = this.emitFile({
                    type: "asset",
                    name: `${path.basename(id)}.wasm`,
                    source
                });

                return compile(code, {
                    as: "boilerplate",
                    filename: file,
                    dev
                });
            }
        }
    };
}
