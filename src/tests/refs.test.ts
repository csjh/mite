import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("refs", () => {
    it("should work with structs", () => {
        const program = `
        struct Foo {
            x: i32,
            y: i32
        }

        export fn main(): i32 {
            let a = Foo { x: 5, y: 6 };
            let b: ref Foo = a;
            b.x = 3;
            return a.x;
        }
        `;

        compileAndRun(program, 3);
    });

    it("should work with arrays", () => {
        const program = `
        export fn main(): i32 {
            let a = [1, 2, 3];
            let b: ref [i32; 3] = a;
            b[0] = 5;
            return a[0];
        }
        `;

        compileAndRun(program, 5);
    });
});
