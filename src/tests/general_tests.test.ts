/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("operator precendence", async () => {
    it("should work with literals", async () => {
        const program1 = `
        export fn main(): i32 {
            return 5 * 2 + 10;
        }
        `;

        await compileAndRun(program1, 20);

        const program2 = `
        export fn main(): i32 {
            return 15 / 3 % 2;
        }
        `;

        await compileAndRun(program2, 1);

        const program3 = `
        export fn main(): i32 {
            return 8 + 4 - 2;
        }
        `;

        await compileAndRun(program3, 10);

        const program4 = `
        export fn main(): i32 {
            return 16 << 2 >> 1;
        }
        `;

        await compileAndRun(program4, 32);

        const program5 = `
        export fn main(): i32 {
            return 9 & 6 ^ 3;
        }`;

        await compileAndRun(program5, 3);

        const program6 = `
        export fn main(): i32 {
            return 7 | 3 == 10;
        }`;

        await compileAndRun(program6, 7);

        const program7 = `
        export fn main(): i32 {
            return 8 != 8 < 5;
        }`;

        await compileAndRun(program7, 1);

        const program8 = `
        export fn main(): i32 {
            return 7 >= 3 && 4 < 9;
        }`;

        await compileAndRun(program8, 1);

        const program9 = `
        export fn main(): i32 {
            return 1 || 0 && 0;
        }`;

        await compileAndRun(program9, 1);
    });

    it("should work with variables", async () => {
        const program1 = `
        export fn main(): i32 {
            let x = 5 * 3 + 2;
            return x;
        }
        `;

        await compileAndRun(program1, 17);

        const program2 = `
        export fn main(): i32 {
            let y = 0;
            return y += 4 % 2;
        }
        `;

        await compileAndRun(program2, 0);

        const program3 = `
        export fn main(): i32 {
            let z = 63;
            z >>= 2 & 3;
            return z;
        }
        `;

        await compileAndRun(program3, 15);

        const program4 = `
        export fn main(): i32 {
            let a = 3;
            a <<= 2 | 3;
            return a;
        }
        `;

        await compileAndRun(program4, 24);

        const program5 = `
        export fn main(): i32 {
            let b = 234;
            b |= 6 ^ 1;
            return b;
        }
        `;

        await compileAndRun(program5, 239);

        const program6 = `
        export fn main(): i32 {
            let c = 2394;
            c ^= 3 & 5;
            return c;
        }
        `;

        await compileAndRun(program6, 2395);

        const program7 = `
        export fn main(): i32 {
            let d = 31;
            return d += d &= 7 | 2;
        }
        `;

        await compileAndRun(program7, 38);
    });
});

describe("literals", async () => {
    it("should work with numbers", async () => {
        const program1 = `
        export fn main(): i32 {
            return 5;
        }
        `;

        await compileAndRun(program1, 5);

        const program2 = `
        export fn main(): i32 {
            return 0;
        }
        `;

        await compileAndRun(program2, 0);

        const program3 = `
        export fn main(): i32 {
            return 0x0;
        }
        `;

        await compileAndRun(program3, 0x0);

        const program4 = `
        export fn main(): i32 {
            return 0x5;
        }
        `;

        await compileAndRun(program4, 0x5);

        const program5 = `
        export fn main(): i32 {
            return 0x0000005;
        }
        `;

        await compileAndRun(program5, 0x0000005);

        const program6 = `
        export fn main(): i32 {
            return 0b101;
        }
        `;

        await compileAndRun(program6, 0b101);

        const program7 = `
        export fn main(): i64 {
            return 0xFFFFFFFFFFFFFFF;
        }
        `;

        await compileAndRun(program7, 0xfffffffffffffffn);

        const program8 = `
        export fn main(): i64 {
            return 0b1111111;
        }
        `;

        await compileAndRun(program8, 0b1111111n);
    });

    it("should work with SIMD", async () => {
        const program1 = `
        export fn main(): i32 {
            let simd = { 1, 2, 3, 4 };
            return extract(simd, 0);
        }
        `;

        await compileAndRun(program1, 1);

        const program2 = `
        export fn main(): i64 {
            let simd = { 1, 2 };
            return extract(simd, 1);
        }
        `;

        await compileAndRun(program2, 2n);

        const program3 = `
        export fn main(): f32 {
            let simd = { 1.0, 2.1, 3.4, 4.1 };
            return extract(simd, 2);
        }
        `;

        await compileAndRun(program3, 3.4000000953674316);

        const program4 = `
        export fn main(): f64 {
            let simd = { 1.0, 2.1 };
            return extract(simd, 1);
        }
        `;

        await compileAndRun(program4, 2.1);

        const program5 = `
        export fn main(): i32 {
            let simd = { 1, 2, 3, 4 };
            return extract(simd, 3);
        }
        `;

        await compileAndRun(program5, 4);
    });
});

describe("unary operators", async () => {
    it("should work with numbers", async () => {
        const program1 = `
        export fn main(): i32 {
            return -5;
        }
        `;

        await compileAndRun(program1, -5);

        const program2 = `
        export fn main(): i32 {
            return ~5;
        }
        `;

        await compileAndRun(program2, -6);

        const program3 = `
        export fn main(): i32 {
            return !0;
        }
        `;

        await compileAndRun(program3, 1);

        const program4 = `
        export fn main(): i32 {
            return !!0;
        }
        `;

        await compileAndRun(program4, 0);
    });

    it("should work with SIMD", async () => {
        const program1 = `
        export fn main(): i32 {
            let simd = { 1, 2, 3, 4 };
            return extract(-simd, 0);
        }
        `;

        await compileAndRun(program1, -1);

        const program2 = `
        export fn main(): i64 {
            let simd = { 1, 2 };
            return extract(~simd, 1);
        }
        `;

        await compileAndRun(program2, -3n);
    });
});
