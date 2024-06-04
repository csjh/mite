/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../utils.js";

describe("array initialization", async () => {
    it("should work with static sized arrays", async () => {
        const module = await getSingleModule(
            new URL("./static-sized-arrays.mite", import.meta.url)
        );

        expect(module.main()).toBe(6);
    });

    it("should work with dynamic sized arrays", async () => {
        const module = await getSingleModule(
            new URL("./dynamic-sized-arrays.mite", import.meta.url)
        );

        expect(module.addition()).toBe(6);
        expect(module.reassignment()).toBe(1);
    });
});

describe("array functions", async () => {
    it("should work with return values", async () => {
        const module = await getSingleModule(
            new URL("./return-value-arrays.mite", import.meta.url)
        );

        expect(module.main()).toBe(16);
    });

    it("should work with nested function calls", async () => {
        const module = await getSingleModule(
            new URL("./nested-function-arrays.mite", import.meta.url)
        );

        expect(module.single_layer()).toBe(16);
        expect(module.double_layer()).toBe(19);
        expect(module.double_layer_indexed()).toBe(19);
        expect(module.double_layer_inlined()).toBe(19);
    });
});
