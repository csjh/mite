import { describe, it } from "bun:test";
import { compileAndRun } from "./utils.js";

describe("refs", async () => {
    it("should work with structs", async () => {
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

        await compileAndRun(program, 3);
    });

    it("should work with arrays", async () => {
        const program = `
        export fn main(): i32 {
            let a = [1, 2, 3];
            let b: ref [i32; 3] = a;
            b[0] = 5;
            return a[0];
        }
        `;

        await compileAndRun(program, 5);
    });

    it("should work with struct members", async () => {
        const program = `
        struct Coord {
            x: i32,
            y: i32
        }

        struct Foo {
            shared: ref Coord
        }

        export fn main(): i32 {
            let a = Coord { x: 5, y: 6 };
            let b = Foo { shared: a };
            let c = Foo { shared: a };
            b.shared.x = 3;
            return b.shared.x == c.shared.x;
        }
        `;

        await compileAndRun(program, 1);
    });
});
