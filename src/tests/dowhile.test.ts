/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("do while loops should work", async () => {
    it("should compile and run", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                sum = sum + i;
                i = i + 1;
            } while (i < 10);
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });
});

describe("do while loops should work with expressions", async () => {
    it("should allow a block expression in the test", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                sum = sum + i;
                i = i + 1;
            } while ({ i < 10; });
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });

    it("should allow a block expression in the body", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                {
                    sum = sum + i;
                };
                i = i + 1;
            } while (i < 10);
            return sum;
        }
        `;

        await compileAndRun(program, 45);
    });

    it("should allow an empty everything", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            do {} while (0);
            return sum;
        }
        `;

        await compileAndRun(program, 0);

        const program2 = `
        export fn main(): i32 {
            let sum = 0;
            do {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            } while (1);
            return sum;
        }
        `;

        await compileAndRun(program2, 10);
    });

    it("should work fine with break", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                sum = sum + i;
                if (i == 5) {
                    break;
                };
                i = i + 1;
            } while (i < 10);
            return sum;
        }
        `;

        await compileAndRun(program, 15);

        const program2 = `
        export fn main(): i32 {
            let sum = 0;
            do {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            } while (1);
            return sum;
        }
        `;

        await compileAndRun(program2, 10);

        const program3 = `
        export fn main(): i32 {
            let sum = 0;
            do {
                sum = sum + 1;
                do {
                    sum = sum + 1;
                    if (sum >= 10) {
                        break;
                    };
                } while (1);
                if (sum >= 20) {
                    break;
                };
            } while (1);
            return sum;
        }
        `;

        await compileAndRun(program3, 20);
    });

    it("should work fine with continue", async () => {
        const program = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                sum = sum + i;
                i = i + 1;
                if (i == 5) {
                    continue;
                };
            } while (i < 10);
            return sum;
        }
        `;

        await compileAndRun(program, 45);

        const program2 = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                i = i + 1;
                if (i % 10) {
                    continue;
                };
                sum = sum + i;
            } while (i < 100);
            return sum;
        }
        `;

        await compileAndRun(program2, 550);

        const program3 = `
        export fn main(): i32 {
            let sum = 0;
            let i = 0;
            do {
                i = i + 1;
                if (i % 10) {
                    continue;
                };
                sum = sum + i;
                let j = 0;
                do {
                    j = j + 1;
                    if (j % 10) {
                        continue;
                    };
                    sum = sum + j;
                    if (sum >= 20) {
                        break;
                    };
                } while (j < 100);
                if (sum >= 20) {
                    break;
                };
            } while (i < 100);
            return sum;
        }
        `;

        await compileAndRun(program3, 20);
    });
});
