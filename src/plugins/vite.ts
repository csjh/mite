import type { Plugin } from "vite";
import { compile } from "../compiler.js";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { glob } from "glob";

const dev = process.env.NODE_ENV === "development";

async function generateType(file: string) {
    if (!file.endsWith(".mite")) return;

    const dts = await fs.readFile(file, "utf-8").then((code) => compile(code, { as: "dts" }));
    const destination = path.join(".mite/types", `${file.replace(process.cwd(), "")}.d.ts`);
    if (!existsSync(path.dirname(destination))) {
        await fs.mkdir(path.dirname(destination), { recursive: true });
    }
    await fs.writeFile(destination, dts);
}

type MiteFileData = {
    code: string;
    wasmReferenceId: string;
};

export async function mite(): Promise<Plugin<never>> {
    await fs.access(".mite").catch(() => fs.mkdir(".mite"));
    await fs.access(".mite/types").catch(() => fs.mkdir(".mite/types"));

    const processed_mite_files = new Map<string, MiteFileData>();

    return {
        name: "vite-plugin-mite",
        async configureServer(server) {
            server.watcher.on("add", generateType);
            server.watcher.on("change", generateType);
            server.watcher.on("unlink", (file) =>
                fs.rm(path.join(".mite/types", `${file.replace(process.cwd(), "")}.d.ts`))
            );

            const mite_files = await glob("**/*.mite", { ignore: "node_modules/**" });
            await Promise.all(mite_files.map(generateType));
        },
        transform(code, id, opts = {}) {
            if (!id.endsWith(".mite")) return null;

            if (dev) {
                const source = compile(code, { optimize: false });

                return compile(code, {
                    as: "javascript",
                    createInstance(imports) {
                        return {
                            instantiation: `WebAssembly.instantiate(Uint8Array.from(atob("${Buffer.from(source).toString("base64")}"), (c) => c.charCodeAt(0)), ${imports})`
                        };
                    }
                });
            } else {
                const file = this.emitFile({
                    type: "asset",
                    // todo: add hash to file name derived from file and dependencies
                    fileName: `${path.basename(id)}.wasm`
                });
                processed_mite_files.set(id, { code, wasmReferenceId: file });

                return compile(code, {
                    as: "javascript",
                    createInstance(imports) {
                        if (opts.ssr) {
                            return {
                                setup: 'import { readFileSync } from "node:fs";',
                                instantiation: `WebAssembly.instantiate(readFileSync(import.meta.ROLLUP_FILE_URL_${file}), ${imports})`
                            };
                        } else {
                            return {
                                instantiation: `WebAssembly.instantiateStreaming(fetch(import.meta.ROLLUP_FILE_URL_${file}), ${imports})`
                            };
                        }
                    }
                });
            }
        },
        generateBundle(_options, _bundle) {
            for (const [id, { code, wasmReferenceId }] of processed_mite_files.entries()) {
                this.setAssetSource(wasmReferenceId, compile(code, { optimize: true }));
                processed_mite_files.delete(id);
            }
        }
    };
}
