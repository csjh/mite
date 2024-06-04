import { describe, it, expect } from "bun:test";
import { getSingleModule } from "../utils.js";

describe("refs", async () => {
    it("should work with structs", async () => {
        const module = await getSingleModule(new URL("./struct-ref.mite", import.meta.url));

        expect(module.main()).toBe(3);
    });

    it("should work with arrays", async () => {
        const module = await getSingleModule(new URL("./array-ref.mite", import.meta.url));

        expect(module.main()).toBe(5);
    });

    it("should work with struct members", async () => {
        const module = await getSingleModule(new URL("./struct-member-ref.mite", import.meta.url));

        expect(module.main()).toBe(1);
    });
});
