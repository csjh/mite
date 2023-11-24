/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test";
import { compileAndRun } from "./utils.js";
import { compile } from "../compiler.js";
import assert from "assert";

describe("general errors", () => {
    it("should detect ", () => {
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
    });

    it("should not stack overflow with a 64kb stack", () => {
        const program = `
        export fn main(): i32 {
            let x: struct_12;
            x.x.x.x.x.x.x.x.x.x.x.x.x.x = 5;
        
            return 0;
        }
        
        struct struct_0 {
            x: i64,
            y: i64
        }
        
        struct struct_1 {
            x: struct_0,
            y: struct_0
        }
        
        struct struct_2 {
            x: struct_1,
            y: struct_1
        }
        
        struct struct_3 {
            x: struct_2,
            y: struct_2
        }
        
        struct struct_4 {
            x: struct_3,
            y: struct_3
        }
        
        struct struct_5 {
            x: struct_4,
            y: struct_4
        }
        
        struct struct_6 {
            x: struct_5,
            y: struct_5
        }
        
        struct struct_7 {
            x: struct_6,
            y: struct_6
        }
        
        struct struct_8 {
            x: struct_7,
            y: struct_7
        }
        
        struct struct_9 {
            x: struct_8,
            y: struct_8
        }
        
        struct struct_10 {
            x: struct_9,
            y: struct_9
        }
        
        struct struct_11 {
            x: struct_10,
            y: struct_10
        }
        
        struct struct_12 {
            x: struct_11,
            y: struct_11
        }
        `;

        compileAndRun(program, 0);
    });

    it("should stack overflow with a 64kb + 16 bytes stack", () => {
        const program = `
        export fn main(): i32 {
            let x: struct_12;
            x.x.x.x.x.x.x.x.x.x.x.x.x.x = 5;
            let breaking_point = { x: 6, y: 6 };
        
            return 0;
        }
        
        struct struct_0 {
            x: i64,
            y: i64
        }
        
        struct struct_1 {
            x: struct_0,
            y: struct_0
        }
        
        struct struct_2 {
            x: struct_1,
            y: struct_1
        }
        
        struct struct_3 {
            x: struct_2,
            y: struct_2
        }
        
        struct struct_4 {
            x: struct_3,
            y: struct_3
        }
        
        struct struct_5 {
            x: struct_4,
            y: struct_4
        }
        
        struct struct_6 {
            x: struct_5,
            y: struct_5
        }
        
        struct struct_7 {
            x: struct_6,
            y: struct_6
        }
        
        struct struct_8 {
            x: struct_7,
            y: struct_7
        }
        
        struct struct_9 {
            x: struct_8,
            y: struct_8
        }
        
        struct struct_10 {
            x: struct_9,
            y: struct_9
        }
        
        struct struct_11 {
            x: struct_10,
            y: struct_10
        }
        
        struct struct_12 {
            x: struct_11,
            y: struct_11
        }
        `;

        compileAndRun(program, "error");
    });
});
