/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { compile } from "../../../compiler.js";

const seniority = ["f64", "f32", "i64", "i32", "i16", "i8", "bool"];

function snippet_should(what: "run" | "error", statement: string) {
    const exec = expect(
        compile(`fn main(): i32 { ${statement}; return 0; }`, {
            resolveImport: async () => ({
                isMite: false,
                absolute: "",
                code: ""
            })
        })
    );

    if (what === "run") {
        exec.resolves.toBeDefined();
    } else {
        exec.rejects.toThrow();
    }
}

describe("promotion", async () => {
    it("should work upwards", async () => {
        for (let i = 0; i < seniority.length; i++) {
            for (let j = i; j < seniority.length; j++) {
                const a = seniority[i];
                const b = seniority[j];

                // as long as it
                snippet_should(
                    "run",
                    `let a: ${a} = 1;
                     let b: ${b} = 1;
                     a + b;`
                );
            }
        }
    });

    it("should error downwards", async () => {
        for (let i = 0; i < seniority.length; i++) {
            for (let j = i + 1; j < seniority.length; j++) {
                const a = seniority[i];
                const b = seniority[j];

                // as long as it
                snippet_should(
                    "error",
                    `let a: ${a} = 1;
                     let b: ${b} = 1;
                     b + a;`
                );
            }
        }
    });
});
