/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../../utils.js";

describe("do while loops should work with expressions", async () => {
    it("should allow a block expression in the test", async () => {
        const module = await getSingleModule(
            new URL("./expression-condition.mite", import.meta.url)
        );

        expect(module.main()).toBe(45);
    });

    it("should allow a block expression in the body", async () => {
        const module = await getSingleModule(
            new URL("./block-expression-body.mite", import.meta.url)
        );

        expect(module.main()).toBe(45);
    });

    it("should allow an empty everything", async () => {
        const module = await getSingleModule(new URL("./empty-body.mite", import.meta.url));

        expect(module.zero()).toBe(0);
    });

    it("should work fine with break", async () => {
        const module = await getSingleModule(new URL("./break.mite", import.meta.url));

        expect(module.incrementing()).toBe(15);
        expect(module.infinite()).toBe(10);
        expect(module.nested()).toBe(20);
    });

    it("should work fine with continue", async () => {
        const module = await getSingleModule(new URL("./continue.mite", import.meta.url));

        expect(module.simple()).toBe(45);
        expect(module.withskip()).toBe(550);
        expect(module.complex()).toBe(20);
    });
});
