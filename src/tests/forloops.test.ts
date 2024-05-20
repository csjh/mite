/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("for loops should work", async () => {
    it("should compile and run", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 10; i = i + 1) {
                sum = sum + i;
            };
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });
});

describe("for loops should work with expressions", async () => {
    it("should allow a variable assignment in the initializer", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            let i: i32;
            for (i = 0; i < 10; i = i + 1) {
                sum = sum + i;
            };
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });

    it("should allow a block expression in the update", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 10; { i = i + 1; }) {
                sum = sum + i;
            };
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });

    it("should allow a block expression in the body", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 10; i = i + 1) {
                {
                    sum = sum + i;
                };
            };
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });

    it("should allow an empty everything", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            for (;;) {break;};
            return sum;
        }
        `;

        await compileAndRun(program, 0);

        const program2 = `
        export fn main(): i32 {
            let sum = 0;
            for (;;) {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            };
            return sum;
        }
        `;

        await compileAndRun(program2, 10);
    });

    it("should work fine with break", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 10; i = i + 1) {
                sum = sum + i;
                if (i == 5) {
                    break;
                };
            };
            return sum;
        }
        `;

        await compileAndRun(program, 15);

        const program2 = `
        export fn main(): i32 {
            let sum = 0;
            for (;;) {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            };
            return sum;
        }
        `;

        await compileAndRun(program2, 10);

        const program3 = `
        export fn main(): i32 {
            let sum = 0;
            for (;;) {
                sum = sum + 1;
                for (;;) {
                    sum = sum + 1;
                    if (sum >= 10) {
                        break;
                    };
                };
                if (sum >= 20) {
                    break;
                };
            };
            return sum;
        }
        `;

        await compileAndRun(program3, 20);
    });

    it("should work fine with continue", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 10; i = i + 1) {
                if (i == 5) {
                    continue;
                };
                sum = sum + i;
            };
            return sum;
        }
        `;

        await compileAndRun(program, 40);

        const program2 = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 100; i = i + 1) {
                if (i % 10) {
                    continue;
                };
                sum = sum + i;
            };
            return sum;
        }
        `;

        await compileAndRun(program2, 450);

        const program3 = `
        export fn main(): i32 {
            let sum = 0;
            for (let i = 0; i < 100; i = i + 1) {
                if (i % 10) {
                    continue;
                };
                sum = sum + i;
                for (let j = 0; j < 100; j = j + 1) {
                    if (j % 10) {
                        continue;
                    };
                    sum = sum + j;
                    if (sum >= 20) {
                        break;
                    };
                };
                if (sum >= 20) {
                    break;
                };
            };
            return sum;
        }
        `;

        await compileAndRun(program3, 30);
    });
});
