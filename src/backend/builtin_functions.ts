import binaryen from "binaryen";
import { Context } from "../types/code_gen.js";
import { ARENA_HEAP_OFFSET as AHO, ARENA_HEAP_POINTER as AHP } from "./utils.js";

const PAGE_SIZE = 65536;

function enhanced_global(ctx: Context, name: string) {
    return {
        get() {
            return ctx.mod.global.get(name, binaryen.i32);
        },
        set(val: number) {
            return ctx.mod.global.set(name, val);
        }
    };
}

function enhanced_local(ctx: Context, idx: number) {
    return {
        get() {
            return ctx.mod.local.get(idx, binaryen.i32);
        },
        set(val: number) {
            return ctx.mod.local.set(idx, val);
        },
        tee(val: number) {
            return ctx.mod.local.tee(idx, val, binaryen.i32);
        },
        deref: {
            get() {
                return ctx.mod.i32.load(0, 0, ctx.mod.local.get(idx, binaryen.i32), "main_memory");
            },
            set(val: number) {
                return ctx.mod.i32.store(
                    0,
                    0,
                    ctx.mod.local.get(idx, binaryen.i32),
                    val,
                    "main_memory"
                );
            }
        }
    };
}

export function addBuiltins(ctx: Context) {
    const i32 = ctx.mod.i32;

    const ARENA_HEAP_OFFSET = enhanced_global(ctx, AHO);
    const ARENA_HEAP_POINTER = enhanced_global(ctx, AHP);

    const DESIRED_SIZE = enhanced_local(ctx, 0);
    // prettier-ignore
    const arena_heap_malloc = ctx.mod.block(null, [
        ctx.mod.if(
            i32.gt_u(
                i32.add(DESIRED_SIZE.get(), ARENA_HEAP_OFFSET.get()),
                i32.mul(ctx.mod.memory.size("main_memory"), i32.const(PAGE_SIZE))),
            ctx.mod.memory.grow(ctx.mod.memory.size("main_memory"), "main_memory")),

        ARENA_HEAP_OFFSET.set(
            i32.add(DESIRED_SIZE.get(), DESIRED_SIZE.tee(ARENA_HEAP_OFFSET.get()))),

        i32.add(DESIRED_SIZE.get(), ARENA_HEAP_POINTER.get())
    ]);
    ctx.mod.addFunction(
        "arena_heap_malloc",
        binaryen.createType([binaryen.i32]),
        binaryen.i32,
        [],
        arena_heap_malloc
    );

    const arena_heap_reset = ctx.mod.block(null, [ARENA_HEAP_OFFSET.set(i32.const(0))]);
    ctx.mod.addFunction(
        "arena_heap_reset",
        binaryen.createType([]),
        binaryen.none,
        [],
        arena_heap_reset
    );
}
