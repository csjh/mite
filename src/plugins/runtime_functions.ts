// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

export async function base64ToWasm(base64, imports) {
    // rollup doesn't seem to like the deno import so figure that one out
    if (typeof Deno !== "undefined") {
        // const b64 = await import("jsr:@std/encoding/base64");
        // return WebAssembly.instantiate(b64.decode(base64), imports);
    } else if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        return WebAssembly.instantiate(Buffer.from(base64, "base64"), imports);
    } else {
        return WebAssembly.instantiate(
            Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
            imports
        );
    }
}
