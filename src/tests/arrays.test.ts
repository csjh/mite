/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

// describe("array declarations", () => {
//     it("should trigger stack overflow", () => {
//         const program = `
//         export fn main(): i32 {
//             let x: [i32; 16384];
//             x[0] = 5;
//             x[16383] = 5;
//             return 0;
//         }
//         `;

//         compileAndRun(program, 0);

//         const program2 = `
//         export fn main(): i32 {
//             let x: [i32; 16385];
//             x[0] = 5;
//             x[16384] = 5;
//             return 0;
//         }
//         `;

//         assert.throws(() => compileAndRun(program2, 0));
//     });
// });

describe("array initialization", () => {
    it("should work with static sized arrays", () => {
        const program = `
        export fn main(): i32 {
            let x: [i32; 3] = [1, 2, 3];
            return x[0] + x[1] + x[2];
        }
        `;

        compileAndRun(program, 6);
    });

    it("should work with dynamic sized arrays", () => {
        const program = `
        export fn main(): i32 {
            let x: [i32] = [1, 2, 3];
            return x[0] + x[1] + x[2];
        }
        `;

        compileAndRun(program, 6);

        const program2 = `
        export fn main(): i32 {
            let x: [i32];
            x = [1, 2, 3];
            if (0 == (x[0] + x[1] + x[2] == 6)) return 0;
            x = [4, 5, 6];
            return x[0] + x[1] + x[2] == 15;
        }
        `;

        compileAndRun(program2, 1);
    });
});

describe("arena array functions", () => {
    it("should work with return values", () => {
        const program = `
        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return [a[0] + b[0], a[1] + b[1]];
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            let c = add(a, b);
            return c[0] + c[1];
        }
        `;

        compileAndRun(program, 16);
    });

    it("should work with nested function calls", () => {
        const program = `
        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return [a[0] + b[0], a[1] + b[1]];
        }

        fn add2(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return add(a, b);
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            let c = add2(a, b);
            return c[0] + c[1];
        }
        `;

        compileAndRun(program, 16);

        const program2 = `
        fn add_3(a: [i32; 2], b: [i32; 2], c: [i32; 2]): [i32; 2] {
            return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
        }

        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            let z = [1, 2];
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            let c = add(a, b);
            return c[0] + c[1];
        }
        `;

        compileAndRun(program2, 19);

        const program3 = `
        fn add_3(a: [i32; 2], b: [i32; 2], c: [i32; 2]): [i32; 2] {
            return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
        }

        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            let z = [1, 2];
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            return add(a, b)[0] + add(a, b)[1];
        }
        `;

        compileAndRun(program3, 19);

        const program4 = `
        fn add_3(a: [i32; 2], b: [i32; 2], c: [i32; 2]): [i32; 2] {
            return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
        }

        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return add_3(a, b, [1, 2]);
        }

        export fn main(): i32 {
            return add([5, 6], [3, 2])[0] + add([5, 6], [3, 2])[1];
        }
        `;

        compileAndRun(program4, 19);
    });
});

describe("array functions", () => {
    it("should work with return values", () => {
        const program = `
        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return [a[0] + b[0], a[1] + b[1]];
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            let c = add(a, b);
            return c[0] + c[1];
        }
        `;

        compileAndRun(program, 16);
    });

    it("should work with nested function calls", () => {
        const program = `
        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return [a[0] + b[0], a[1] + b[1]];
        }

        fn add2(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return add(a, b);
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            let c = add2(a, b);
            return c[0] + c[1];
        }
        `;

        compileAndRun(program, 16);

        const program2 = `
        fn add_3(a: [i32; 2], b: [i32; 2], c: [i32; 2]): [i32; 2] {
            return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
        }

        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            let z = [1, 2];
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            let c = add(a, b);
            return c[0] + c[1];
        }
        `;

        compileAndRun(program2, 19);

        const program3 = `
        fn add_3(a: [i32; 2], b: [i32; 2], c: [i32; 2]): [i32; 2] {
            return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
        }

        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            let z = [1, 2];
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = [5, 6];
            let b = [3, 2];
            return add(a, b)[0] + add(a, b)[1];
        }
        `;

        compileAndRun(program3, 19);

        const program4 = `
        fn add_3(a: [i32; 2], b: [i32; 2], c: [i32; 2]): [i32; 2] {
            return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
        }

        fn add(a: [i32; 2], b: [i32; 2]): [i32; 2] {
            return add_3(a, b, [1, 2]);
        }

        export fn main(): i32 {
            return add([5, 6], [3, 2])[0] + add([5, 6], [3, 2])[1];
        }
        `;

        compileAndRun(program4, 19);
    });
});
