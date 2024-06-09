/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../../utils.js";

describe("assignment should work", () => {
    it("with nested data structures", async () => {
        const module = await getSingleModule(new URL("./nested.mite", import.meta.url));

        expect(module.main()).toBeCloseTo(5.6);
    });
});
