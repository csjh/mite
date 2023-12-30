import binaryen from "binaryen";
import { Context } from "../types/code_gen.js";
import {
    ARENA_HEAP_OFFSET as AHO,
    ARENA_HEAP_POINTER as AHP,
    JS_HEAP_POINTER as JHP
} from "./utils.js";

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
    const JS_HEAP_POINTER = enhanced_global(ctx, JHP);

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

    const CURRENT_CHUNK_PTR = enhanced_local(ctx, 1);
    const RETURN_POINTER = enhanced_local(ctx, 2);
    const CHUNK_LENGTH = enhanced_local(ctx, 3);
    const CURRENT_CHUNK = enhanced_local(ctx, 4);
    // prettier-ignore
    const js_heap_malloc = ctx.mod.block(null, [
        // start at the beginning of the js heap
        CURRENT_CHUNK_PTR.set(JS_HEAP_POINTER.get()),
        RETURN_POINTER.set(i32.const(-1)),

        ctx.mod.block("return", [
            ctx.mod.loop("find_first_free", ctx.mod.block(null, [
                // if we've reached the end of the js heap, return -1
                ctx.mod.br_if(
                    "return",
                    i32.gt_u(
                        CURRENT_CHUNK_PTR.tee(
                            i32.add(
                                // skip the size of the last chunk
                                i32.add(
                                    CURRENT_CHUNK_PTR.get(),
                                    CHUNK_LENGTH.get()),
                                // 4 bytes for the metadata
                                i32.const(4))),
                        ARENA_HEAP_POINTER.get())),

                ctx.mod.br_if(
                    "find_first_free", 
                    i32.or(
                        // if the chunk isn't big enough
                        i32.lt_u(
                            CHUNK_LENGTH.tee(
                                i32.and(
                                    CURRENT_CHUNK.tee(CURRENT_CHUNK_PTR.deref.get()),
                                    i32.const(0x7FFFFFFF))),
                            DESIRED_SIZE.get()),
                        i32.ge_s(
                            // if sign bit is set, then the number is below 0 in its signed form
                            // set sign bit means it's free, so if it's nonnegative, skip
                            CURRENT_CHUNK.get(),
                            i32.const(0))
                    ))
            ])),

            // store the new size of the chunk
            CURRENT_CHUNK_PTR.deref.set(DESIRED_SIZE.get()),

            // return the current chunk pointer, plus 4 bytes for the metadata
            RETURN_POINTER.set(i32.add(CURRENT_CHUNK_PTR.get(), i32.const(4))),

            // return if it's a perfect match
            ctx.mod.br_if(
                "return", 
                i32.eq(DESIRED_SIZE.get(), CHUNK_LENGTH.get())),

            i32.store(0, 0,
                // store in the metadata of next chunk
                i32.add(
                    DESIRED_SIZE.get(),
                    RETURN_POINTER.get()),
                // set the memory to the remaining size of the chunk (no bitmask needed since current_chunk already has the sign bit set)
                i32.sub(CURRENT_CHUNK.get(), DESIRED_SIZE.get()),
                "main_memory")
        ]),

        RETURN_POINTER.get()
    ]);
    ctx.mod.addFunction(
        "js_heap_malloc",
        binaryen.createType([binaryen.i32]),
        binaryen.i32,
        [binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32],
        js_heap_malloc
    );

    const FREED_PTR = enhanced_local(ctx, 0);
    // prettier-ignore
    const js_heap_free = ctx.mod.block(null, [
        i32.store(0, 0, 
            FREED_PTR.tee(i32.sub(FREED_PTR.get(), i32.const(4))), 
            // set the sign bit to 1
            i32.or(FREED_PTR.deref.get(), i32.const(0x80000000)), "main_memory")
    ]);
    ctx.mod.addFunction(
        "js_heap_free",
        binaryen.createType([binaryen.i32]),
        binaryen.none,
        [],
        js_heap_free
    );
}
