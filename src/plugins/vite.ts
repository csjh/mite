import type { Plugin } from "vite";
import type { PluginContext } from "rollup";
import { compile } from "../compiler.js";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { mite_shared, mite_stl } from "./shared.js";

const dev = process.env.NODE_ENV === "development";

async function generateType(file: string) {
    if (!file.endsWith(".mite")) return;
    const isFile = await fs.stat(file).then((stat) => stat.isFile());
    if (!isFile) return;

    const dts = await fs.readFile(file, "utf-8").then((code) => compile(code, { as: "dts" }));
    const destination = path.join(".mite/types", `${file.replace(process.cwd(), "")}.d.ts`);
    if (!existsSync(path.dirname(destination))) {
        await fs.mkdir(path.dirname(destination), { recursive: true });
    }
    await fs.writeFile(destination, dts);
}

const BANNED_DIRECTORIES = new Set(["node_modules", ".mite"]);
async function* getAllMite(dir = "."): AsyncGenerator<string> {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory() && !BANNED_DIRECTORIES.has(file.name)) {
            yield* getAllMite(path.join(dir, file.name));
        } else if (file.isFile() && file.name.endsWith(".mite")) {
            yield path.join(dir, file.name);
        }
    }
}

function getImportResolver(this: PluginContext, importer: string) {
    return async (p: string) => {
        const resolved = await this.resolve(p, importer);
        if (!resolved) return { isMite: false, absolute: "", code: "" };
        return {
            isMite: resolved.id.endsWith(".mite"),
            absolute: resolved.id,
            code: await fs.readFile(resolved.id, "utf-8")
        };
    };
}

interface MiteFileData {
    code: string;
    wasmReferenceId: string;
}

export async function mite(): Promise<Plugin<never>> {
    await fs.access(".mite").catch(() => fs.mkdir(".mite"));
    await fs.access(".mite/types").catch(() => fs.mkdir(".mite/types"));

    const processed_mite_files = new Map<string, MiteFileData>();

    const mite_shared_id = "mite:shared";
    const resolved_mite_shared_id = `\0${mite_shared_id}`;

    return {
        name: "vite-plugin-mite",
        async configureServer(server) {
            server.watcher.on("add", generateType);
            server.watcher.on("change", generateType);
            server.watcher.on("unlink", (file) =>
                fs.rm(path.join(".mite/types", `${file.replace(process.cwd(), "")}.d.ts`))
            );

            // could be Promise.all'd but really not that serious
            for await (const file of getAllMite()) {
                await generateType(file);
            }
        },
        resolveId(id) {
            const un_mited = id.slice("mite:".length);
            if (id === mite_shared_id) {
                return resolved_mite_shared_id;
            } else if (Object.keys(mite_stl).includes(un_mited)) {
                return `\0${id}`;
            }
        },
        load(id) {
            const un_mited = id.slice("\0mite:".length);
            if (id === resolved_mite_shared_id) {
                return mite_shared;
            } else if (Object.keys(mite_stl).includes(un_mited)) {
                // @ts-expect-error blah blah blah
                return mite_stl[un_mited];
            }
        },
        async transform(code, id, opts = {}) {
            if (!id.endsWith(".mite") && !(id.slice("\0mite:".length) in mite_stl)) return null;

            if (dev) {
                const source = await compile(code, {
                    optimize: false,
                    resolveImport: getImportResolver.call(this, id)
                });

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
        async generateBundle(_options, _bundle) {
            for (const [id, { code, wasmReferenceId }] of processed_mite_files.entries()) {
                this.setAssetSource(
                    wasmReferenceId,
                    await compile(code, {
                        optimize: true,
                        resolveImport: getImportResolver.call(this, id)
                    })
                );
                processed_mite_files.delete(id);
            }
        }
    };
}
