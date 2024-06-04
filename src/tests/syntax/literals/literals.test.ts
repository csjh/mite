/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../../utils.js";
import path from "path";

describe("literals", async () => {
    it("should work with numbers", async () => {
        const module = await getSingleModule(new URL("./literals.mite", import.meta.url));

        expect(module.five()).toBe(5);
        expect(module.zero()).toBe(0);
        expect(module.hexzero()).toBe(0x0);
        expect(module.hexfive()).toBe(0x5);
        expect(module.hexzerosfive()).toBe(0x0000005);
        expect(module.binoneohone()).toBe(0b101);
        expect(module.manyf()).toBe(0xfffffffffffffffn);
        expect(module.manybinones()).toBe(0b1111111n);
    });

    it("should work with SIMD", async () => {
        const module = await getSingleModule(new URL("./literals.mite", import.meta.url));

        expect(module.simdint()).toBe(1);
        expect(module.simdlong()).toBe(2n);
        expect(module.simdfloat()).toBe(3.4000000953674316);
        expect(module.simddouble()).toBe(2.1);
        expect(module.simdint2()).toBe(4);
    });
});
