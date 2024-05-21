import type { Plugin } from "vite";
import { compile } from "../compiler.js";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { glob } from "glob";
import dedent from "dedent";

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

    const mite_shared_id = "virtual:mite-shared";
    const resolved_mite_shared_id = `\0${mite_shared_id}`;

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
        resolveId(id) {
            if (id === mite_shared_id) {
                return resolved_mite_shared_id;
            }
        },
        load(id) {
            if (id === resolved_mite_shared_id) {
                return dedent`
                    export const $memory = new WebAssembly.Memory({ initial: 256 });
                    export const $table = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
                    export const $heap_pointer = new WebAssembly.Global({ value: "i32", mutable: false }, 0);
                    export const $heap_offset = new WebAssembly.Global({ value: "i32", mutable: true }, 0);
            
                    const $encoder = /*#__PURE__*/ new TextEncoder();
                    const $decoder = /*#__PURE__*/ new TextDecoder();
                    const $stringToPointer = /*#__PURE__*/ new Map();
                    const $pointerToString = /*#__PURE__*/ new Map();
            
                    let $dataview = new DataView($memory.buffer);
                    export const $GetBigInt64 =  /*#__PURE__*/ (ptr) => $dataview.getBigInt64(ptr, true);
                    export const $GetBigUint64 = /*#__PURE__*/ (ptr) => $dataview.getBigUint64(ptr, true);
                    export const $GetFloat32 =   /*#__PURE__*/ (ptr) => $dataview.getFloat32(ptr, true);
                    export const $GetFloat64 =   /*#__PURE__*/ (ptr) => $dataview.getFloat64(ptr, true);
                    export const $GetInt16 =     /*#__PURE__*/ (ptr) => $dataview.getInt16(ptr, true);
                    export const $GetInt32 =     /*#__PURE__*/ (ptr) => $dataview.getInt32(ptr, true);
                    export const $GetInt8 =      /*#__PURE__*/ (ptr) => $dataview.getInt8(ptr, true);
                    export const $GetUint16 =    /*#__PURE__*/ (ptr) => $dataview.getUint16(ptr, true);
                    export const $GetUint32 =    /*#__PURE__*/ (ptr) => $dataview.getUint32(ptr, true);
                    export const $GetUint8 =     /*#__PURE__*/ (ptr) => $dataview.getUint8(ptr, true);
                    export const $SetBigInt64 =  /*#__PURE__*/ (ptr, v) => $dataview.setBigInt64(ptr, v, true);
                    export const $SetBigUint64 = /*#__PURE__*/ (ptr, v) => $dataview.setBigUint64(ptr, v, true);
                    export const $SetFloat32 =   /*#__PURE__*/ (ptr, v) => $dataview.setFloat32(ptr, v, true);
                    export const $SetFloat64 =   /*#__PURE__*/ (ptr, v) => $dataview.setFloat64(ptr, v, true);
                    export const $SetInt16 =     /*#__PURE__*/ (ptr, v) => $dataview.setInt16(ptr, v, true);
                    export const $SetInt32 =     /*#__PURE__*/ (ptr, v) => $dataview.setInt32(ptr, v, true);
                    export const $SetInt8 =      /*#__PURE__*/ (ptr, v) => $dataview.setInt8(ptr, v, true);
                    export const $SetUint16 =    /*#__PURE__*/ (ptr, v) => $dataview.setUint16(ptr, v, true);
                    export const $SetUint32 =    /*#__PURE__*/ (ptr, v) => $dataview.setUint32(ptr, v, true);
                    export const $SetUint8 =     /*#__PURE__*/ (ptr, v) => $dataview.setUint8(ptr, v, true);

                    export function $updateDataView() {
                        $dataview = new DataView($memory.buffer);
                    }
                    ${/* function bindings actually don't really care about types */ ""}
                    export function $toJavascriptFunction($ptr) {
                        const $fn = $table.get($GetUint32($ptr)).bind(null, $GetUint32($ptr + 4));
                        $fn._ = $ptr;
                        return $fn;
                    }
            
                    export function $toJavascriptString($ptr) {
                        if ($pointerToString.has($ptr)) return $pointerToString.get($ptr);
            
                        const $str = $decoder.decode(new Uint8Array($memory.buffer, $ptr + 4, $GetUint32($ptr)));
            
                        $pointerToString.set($ptr, $str);
                        $stringToPointer.set($str, $ptr);
            
                        return $str;
                    }
                    ${/* Courtesy of emscripten */ ""}
                    function $utf8Length($str) {
                        var $len = 0;
                        for (var $i = 0; $i < $str.length; ++$i) {
                            var $c = $str.charCodeAt($i);
                            if ($c <= 127) {
                                ++$len;
                            } else if ($c <= 2047) {
                                $len += 2;
                            } else if ($c >= 55296 && $c <= 57343) {
                                $len += 4;
                                ++$i;
                            } else {
                                $len += 3;
                            }
                        }
                        return $len;
                    }
            
                    export function $fromJavascriptString($str) {
                        if ($stringToPointer.has($str)) return $stringToPointer.get($str);
            
                        const $len = $utf8Length($str);
                        const $ptr = $arena_heap_malloc(4 + $len);
                        $SetUint32($ptr, $len);
            
                        const $output = new Uint8Array($memory.buffer, $ptr + 4, $len);
                        $encoder.encodeInto($str, $output);
            
                        $pointerToString.set($ptr, $str);
                        $stringToPointer.set($str, $ptr);
            
                        return $ptr;
                    }

                    export function $arena_heap_malloc($desired_size) {
                        $desired_size >>>= 0;

                        if (($desired_size + $heap_offset.value + $heap_pointer.value) >= ($dataview.byteLength)) {
                            $memory.grow($dataview.byteLength >>> 16);
                            $updateDataView();
                        }
                
                        $heap_offset.value = $desired_size + ($desired_size = $heap_offset.value);
                
                        return $desired_size + $heap_pointer.value;
                    }
                `;
            }
        },
        async transform(code, id, opts = {}) {
            if (!id.endsWith(".mite")) return null;

            if (dev) {
                const source = await compile(code, {
                    optimize: false,
                    resolveImport: async (p) => {
                        return fs.readFile(path.resolve(path.dirname(id), p), "utf-8");
                    }
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
                        resolveImport: async (p) => {
                            return fs.readFile(path.resolve(path.dirname(id), p), "utf-8");
                        }
                    })
                );
                processed_mite_files.delete(id);
            }
        }
    };
}
