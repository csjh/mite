/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../../utils.js";

describe("for loops should work with expressions", async () => {
    it("should allow a variable assignment in the initializer", async () => {
        const module = await getSingleModule(new URL("./assignment-init.mite", import.meta.url));

        expect(module.main()).toBe(45);
    });

    it("should allow a block expression in the update", async () => {
        const module = await getSingleModule(
            new URL("./block-expression-update.mite", import.meta.url)
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
        const module = await getSingleModule(new URL("./empty-everything.mite", import.meta.url));

        expect(module.instabreak()).toBe(0);
        expect(module.laterbreak()).toBe(10);
    });

    it("should work fine with break", async () => {
        const module = await getSingleModule(new URL("./break.mite", import.meta.url));

        expect(module.laterbreak()).toBe(15);
        expect(module.infinibreak()).toBe(10);
        expect(module.complexbreak()).toBe(20);
    });

    it("should work fine with continue", async () => {
        const module = await getSingleModule(new URL("./continue.mite", import.meta.url));

        expect(module.simplecontinue()).toBe(40);
        expect(module.latercontinue()).toBe(450);
        expect(module.complexcontinue()).toBe(30);
    });
});
