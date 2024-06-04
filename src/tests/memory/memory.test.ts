/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../utils.js";

describe("memory size", async () => {
    it("shouldn't run out", async () => {
        const module = await getSingleModule(new URL("./67mb.mite", import.meta.url));

        expect(module.main()).toBe(0);
    });
});
