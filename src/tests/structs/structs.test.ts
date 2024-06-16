/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { compile } from "../../compiler.js";
import { getSingleModule } from "../utils.js";

describe("struct declarations", async () => {
    it("should detect cycles", async () => {
        const program = `
        struct x {
            uses: y,
            hi: i32
        }

        struct y {
            uses: x
        }
        `;

        expect(
            compile(program, {
                resolveImport: async () => ({
                    isMite: false,
                    absolute: "",
                    code: ""
                })
            })
        ).rejects.toThrow();

        const program2 = `
        struct x {
            uses: y,
            hi: i32
        }

        struct y {
            uses: z
        }

        struct z {
            uses: x
        }
        `;

        expect(
            compile(program2, {
                resolveImport: async () => ({
                    isMite: false,
                    absolute: "",
                    code: ""
                })
            })
        ).rejects.toThrow();

        const program3 = `
        struct z {
            uses: x
        }
        
        struct x {
            uses: y,
            hi: i32
        }
        
        struct y {
            uses: z
        }`;

        expect(
            compile(program3, {
                resolveImport: async () => ({
                    isMite: false,
                    absolute: "",
                    code: ""
                })
            })
        ).rejects.toThrow();

        const program4 = `
        struct x {
            uses: x
        }`;

        expect(
            compile(program4, {
                resolveImport: async () => ({
                    isMite: false,
                    absolute: "",
                    code: ""
                })
            })
        ).rejects.toThrow();

        const program5 = `
        struct x {
            uses: y
        }`;

        expect(
            compile(program5, {
                resolveImport: async () => ({
                    isMite: false,
                    absolute: "",
                    code: ""
                })
            })
        ).rejects.toThrow();
    });

    it("shouldn't throw on valid structs", async () => {
        const program = `
        struct x {
            uses: y,
            hi: i32,
            bye: z
        }

        struct y {
            uses: i32
        }

        struct z {
            uses: i32
        }
        `;

        await compile(program, {
            resolveImport: async () => ({
                isMite: false,
                absolute: "",
                code: ""
            })
        });
    });
});

describe("struct functions", async () => {
    it("should work with return values", async () => {
        const module = await getSingleModule(
            new URL("./return-value-struct.mite", import.meta.url)
        );

        expect(module.main()).toBe(16);
    });

    it("should work with nested function calls", async () => {
        const module = await getSingleModule(
            new URL("./nested-function-struct.mite", import.meta.url)
        );

        expect(module.single_layer()).toBe(16);
        expect(module.double_layer()).toBe(19);
        expect(module.double_layer_deref()).toBe(19);
        expect(module.double_layer_inlined()).toBe(19);
    });
});
