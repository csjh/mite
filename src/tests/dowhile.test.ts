/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("do while loops should work", () => {
    it("should compile and run", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
            do {
                sum = sum + i;
                i = i + 1;
            } while (i < 10);
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });
});

describe("do while loops should work with expressions", () => {
    it("should allow a block expression in the test", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
            do {
                sum = sum + i;
                i = i + 1;
            } while ({ i < 10; });
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });

    it("should allow a block expression in the body", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
            do {
                {
                    sum = sum + i;
                };
                i = i + 1;
            } while (i < 10);
            return sum;
        }
        `;

        compileAndRun(program, 45);
    });

    it("should allow an empty everything", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            do {} while (0);
            return sum;
        }
        `;
        console.log("first");

        compileAndRun(program, 0);

        const program2 = `
        fn main(): i32 {
            i32 sum = 0;
            do {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            } while (1);
            return sum;
        }
        `;
        console.log("second");

        compileAndRun(program2, 10);
    });

    it("should work fine with break", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
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

        compileAndRun(program, 15);

        const program2 = `
        fn main(): i32 {
            i32 sum = 0;
            do {
                sum = sum + 1;
                if (sum == 10) {
                    break;
                };
            } while (1);
            return sum;
        }
        `;

        compileAndRun(program2, 10);

        const program3 = `
        fn main(): i32 {
            i32 sum = 0;
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

        compileAndRun(program3, 20);
    });

    it("should work fine with continue", () => {
        const program = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
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

        compileAndRun(program, 45);

        const program2 = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
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

        compileAndRun(program2, 550);

        const program3 = `
        fn main(): i32 {
            i32 sum = 0;
            i32 i = 0;
            do {
                i = i + 1;
                if (i % 10) {
                    continue;
                };
                sum = sum + i;
                i32 j = 0;
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

        compileAndRun(program3, 20);
    });
});
