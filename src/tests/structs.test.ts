/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";
import { compile } from "../compiler.js";
import assert from "assert";

describe("struct declarations", () => {
    it("should detect cycles", () => {
        const program = `
        struct x {
            uses: y,
            hi: i32
        }

        struct y {
            uses: x
        }
        `;

        assert.throws(() => compile(program));

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

        assert.throws(() => compile(program2));

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

        assert.throws(() => compile(program3));

        const program4 = `
        struct x {
            uses: x
        }`;

        assert.throws(() => compile(program4));

        const program5 = `
        struct x {
            uses: y
        }`;

        assert.throws(() => compile(program5));
    });

    it("shouldn't throw on valid structs", () => {
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

        compile(program);
    });
});

describe("arena struct functions", () => {
    it("should work with return values", () => {
        const program = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add(a: coord, b: coord): coord {
            return coord {
                x: a.x + b.x,
                y: a.y + b.y
            };
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            let c = add(a, b);
            return c.x + c.y;
        }
        `;

        compileAndRun(program, 16);
    });

    it("should work with nested function calls", () => {
        const program = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add(a: coord, b: coord): coord {
            return coord {
                x: a.x + b.x,
                y: a.y + b.y
            };
        }

        fn add2(a: coord, b: coord): coord {
            return add(a, b);
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            let c = add2(a, b);
            return c.x + c.y;
        }
        `;

        compileAndRun(program, 16);

        const program2 = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add_3(a: coord, b: coord, c: coord): coord {
            return coord {
                x: a.x + b.x + c.x,
                y: a.y + b.y + c.y
            };
        }

        fn add(a: coord, b: coord): coord {
            let z = coord { x: 1, y: 2 };
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            let c = add(a, b);
            return c.x + c.y;
        }
        `;

        compileAndRun(program2, 19);

        const program3 = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add_3(a: coord, b: coord, c: coord): coord {
            return coord {
                x: a.x + b.x + c.x,
                y: a.y + b.y + c.y
            };
        }

        fn add(a: coord, b: coord): coord {
            let z = coord { x: 1, y: 2 };
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            return add(a, b).x + add(a, b).y;
        }
        `;

        compileAndRun(program3, 19);

        const program4 = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add_3(a: coord, b: coord, c: coord): coord {
            return coord {
                x: a.x + b.x + c.x,
                y: a.y + b.y + c.y
            };
        }

        fn add(a: coord, b: coord): coord {
            return add_3(a, b, coord { x: 1, y: 2 });
        }

        export fn main(): i32 {
            return add(coord { x: 5, y: 6 }, coord { x: 3, y: 2 }).x + 
                   add(coord { x: 5, y: 6 }, coord { x: 3, y: 2 }).y;
        }
        `;

        compileAndRun(program4, 19);
    });
});

describe("struct functions", () => {
    it("should work with return values", () => {
        const program = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add(a: coord, b: coord): coord {
            return coord {
                x: a.x + b.x,
                y: a.y + b.y
            };
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            let c = add(a, b);
            return c.x + c.y;
        }
        `;

        compileAndRun(program, 16);
    });

    it("should work with nested function calls", () => {
        const program = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add(a: coord, b: coord): coord {
            return coord {
                x: a.x + b.x,
                y: a.y + b.y
            };
        }

        fn add2(a: coord, b: coord): coord {
            return add(a, b);
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            let c = add2(a, b);
            return c.x + c.y;
        }
        `;

        compileAndRun(program, 16);

        const program2 = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add_3(a: coord, b: coord, c: coord): coord {
            return coord {
                x: a.x + b.x + c.x,
                y: a.y + b.y + c.y
            };
        }

        fn add(a: coord, b: coord): coord {
            let z = coord { x: 1, y: 2 };
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            let c = add(a, b);
            return c.x + c.y;
        }
        `;

        compileAndRun(program2, 19);

        const program3 = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add_3(a: coord, b: coord, c: coord): coord {
            return coord {
                x: a.x + b.x + c.x,
                y: a.y + b.y + c.y
            };
        }

        fn add(a: coord, b: coord): coord {
            let z = coord { x: 1, y: 2 };
            return add_3(a, b, z);
        }

        export fn main(): i32 {
            let a = coord { x: 5, y: 6 };
            let b = coord { x: 3, y: 2 };
            return add(a, b).x + add(a, b).y;
        }
        `;

        compileAndRun(program3, 19);

        const program4 = `
        struct coord {
            x: i32,
            y: i32
        }

        fn add_3(a: coord, b: coord, c: coord): coord {
            return coord {
                x: a.x + b.x + c.x,
                y: a.y + b.y + c.y
            };
        }

        fn add(a: coord, b: coord): coord {
            return add_3(a, b, coord { x: 1, y: 2 });
        }

        export fn main(): i32 {
            return add(coord { x: 5, y: 6 }, coord { x: 3, y: 2 }).x + 
                   add(coord { x: 5, y: 6 }, coord { x: 3, y: 2 }).y;
        }
        `;

        compileAndRun(program4, 19);
    });
});
