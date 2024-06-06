/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../../utils.js";

describe("operator precendence", async () => {
    it("should work with literals", async () => {
        const module = await getSingleModule(new URL("./literal-operators.mite", import.meta.url));

        expect(module.muladd()).toBe(20);
        expect(module.divmod()).toBe(1);
        expect(module.addsub()).toBe(10);
        expect(module.shlshr()).toBe(32);
        expect(module.andxor()).toBe(3);
        expect(module.oreq()).toBe(0);
        expect(module.gelandlt()).toBe(1);
        expect(module.lorland()).toBe(1);
    });

    it("should work with variables", async () => {
        const module = await getSingleModule(new URL("./variable-operators.mite", import.meta.url));

        expect(module.muladd()).toBe(17);
        expect(module.pluseqmod()).toBe(0);
        expect(module.shrassign()).toBe(15);
        expect(module.shlassign()).toBe(24);
        expect(module.orassign()).toBe(239);
        expect(module.xorassign()).toBe(2395);
        expect(module.doubleassign()).toBe(38);
    });
});

describe("unary operators", async () => {
    it("should work with numbers", async () => {
        const module = await getSingleModule(new URL("./unary-operators.mite", import.meta.url));

        expect(module.neg()).toBe(-5);
        expect(module.not()).toBe(-6);
        expect(module.lnot()).toBe(1);
        expect(module.doublelnot()).toBe(0);
    });

    it("should work with SIMD", async () => {
        const module = await getSingleModule(new URL("./simd-operators.mite", import.meta.url));

        expect(module.neg()).toBe(-1);
        expect(module.not()).toBe(-3n);
    });
});
