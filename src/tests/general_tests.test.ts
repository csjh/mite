/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("operator precendence", () => {
    it("should work with literals", () => {
        const program1 = `
        export fn main(): i32 {
            return 5 * 2 + 10;
        }
        `;

        compileAndRun(program1, 20);

        const program2 = `
        export fn main(): i32 {
            return 15 / 3 % 2;
        }
        `;

        compileAndRun(program2, 1);

        const program3 = `
        export fn main(): i32 {
            return 8 + 4 - 2;
        }
        `;

        compileAndRun(program3, 10);

        const program4 = `
        export fn main(): i32 {
            return 16 << 2 >> 1;
        }
        `;

        compileAndRun(program4, 32);

        const program5 = `
        export fn main(): i32 {
            return 9 & 6 ^ 3;
        }`;

        compileAndRun(program5, 3);

        const program6 = `
        export fn main(): i32 {
            return 7 | 3 == 10;
        }`;

        compileAndRun(program6, 7);

        const program7 = `
        export fn main(): i32 {
            return 8 != 8 < 5;
        }`;

        compileAndRun(program7, 1);

        const program8 = `
        export fn main(): i32 {
            return 7 >= 3 && 4 < 9;
        }`;

        compileAndRun(program8, 1);

        const program9 = `
        export fn main(): i32 {
            return 1 || 0 && 0;
        }`;

        compileAndRun(program9, 1);
    });

    it("should work with variables", () => {
        const program1 = `
        export fn main(): i32 {
            i32 x = 5 * 3 + 2;
            return x;
        }
        `;

        compileAndRun(program1, 17);

        const program2 = `
        export fn main(): i32 {
            i32 y = 0;
            return y += 4 % 2;
        }
        `;

        compileAndRun(program2, 0);

        const program3 = `
        export fn main(): i32 {
            i32 z = 63;
            z >>= 2 & 3;
            return z;
        }
        `;

        compileAndRun(program3, 15);

        const program4 = `
        export fn main(): i32 {
            i32 a = 3;
            a <<= 2 | 3;
            return a;
        }
        `;

        compileAndRun(program4, 24);

        const program5 = `
        export fn main(): i32 {
            i32 b = 234;
            b |= 6 ^ 1;
            return b;
        }
        `;

        compileAndRun(program5, 239);

        const program6 = `
        export fn main(): i32 {
            i32 c = 2394;
            c ^= 3 & 5;
            return c;
        }
        `;

        compileAndRun(program6, 2395);

        const program7 = `
        export fn main(): i32 {
            i32 d = 31;
            return d += d &= 7 | 2;
        }
        `;

        compileAndRun(program7, 38);
    });
});
