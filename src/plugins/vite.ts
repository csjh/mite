import type { Plugin } from "vite";
import { compile } from "../compiler.js";
import path from "path";
import fs from "fs/promises";
import { glob } from "glob";

const dev = process.env.NODE_ENV === "development";

async function generateType(file: string) {
    if (!file.endsWith(".mite")) return;

    const dts = await fs.readFile(file, "utf-8").then((code) => compile(code, { as: "dts" }));

    await fs.writeFile(path.join(".mite/types", `${file.replace(process.cwd(), "")}.d.ts`), dts);
}

export async function mite(): Promise<Plugin> {
    await fs.access(".mite").catch(() => fs.mkdir(".mite"));
    await fs.access(".mite/types").catch(() => fs.mkdir(".mite/types"));

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
        transform(code, id) {
            if (!id.endsWith(".mite")) return null;

            const source = compile(code, { optimize: true });

            if (dev) {
                return compile(code, {
                    as: "javascript",
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
                    as: "javascript",
                    filename: file,
                    dev
                });
            }
        }
    } satisfies Plugin;
}
