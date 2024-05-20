/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("memory size", async () => {
    it("shouldn't run out", async () => {
        const program = `
        export fn main(): i32 {
            for (let i = 0; i < 1024; i += 1) {
                let x: [i8; 65536];
            };
            return 0;
        }
        `;

        await compileAndRun(program, 0);
    });
});
