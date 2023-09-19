/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("for loops should work", () => {
    it("should compile and run", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            for (i32 i = 0; i < 10; i = i + 1) {
                sum = sum + i;
            };
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });
});

describe("for loops should work with expressions", () => {
    it("should allow a variable assignment in the initializer", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i;
            for (i = 0; i < 10; i = i + 1) {
                sum = sum + i;
            };
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });

    it("should allow a block expression in the update", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            for (i32 i = 0; i < 10; { i = i + 1; }) {
                sum = sum + i;
            };
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });

    it("should allow a block expression in the body", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            for (i32 i = 0; i < 10; i = i + 1) {
                {
                    sum = sum + i;
                };
            };
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });

    it("should allow an empty everything", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            for (;0;) {};
            return sum;
        }
        `;

        compileAndRun(program, 0);

        const program2 = `
        fn main(): i32 {
            i32 sum = 0;
            for (;;) {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            };
            return sum;
        }
        `;

        compileAndRun(program2, 10);
    });
});
