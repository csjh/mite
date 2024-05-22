import binaryen from "binaryen";
import { Context } from "../types/code_gen.js";
import { ARENA_HEAP_OFFSET as AHO, ARENA_HEAP_POINTER as AHP } from "./utils.js";

const PAGE_SIZE = 65536;

function enhanced_global(mod: binaryen.Module, name: string) {
    return {
        get() {
            return mod.global.get(name, binaryen.i32);
        },
        set(val: number) {
            return mod.global.set(name, val);
        }
    };
}

function enhanced_local(mod: binaryen.Module, idx: number) {
    return {
        get() {
            return mod.local.get(idx, binaryen.i32);
        },
        set(val: number) {
            return mod.local.set(idx, val);
        },
        tee(val: number) {
            return mod.local.tee(idx, val, binaryen.i32);
        },
        deref: {
            get() {
                return mod.i32.load(0, 0, mod.local.get(idx, binaryen.i32), "main_memory");
            },
            set(val: number) {
                return mod.i32.store(0, 0, mod.local.get(idx, binaryen.i32), val, "main_memory");
            }
        }
    };
}

export function addBuiltins(ctx: Context) {
    const mod = ctx.mod;
    const i32 = mod.i32;

    const ARENA_HEAP_OFFSET = enhanced_global(mod, AHO);
    const ARENA_HEAP_POINTER = enhanced_global(mod, AHP);

    ctx.mod.addFunctionImport(
        "$update_dataview",
        "$mite",
        "$update_dataview",
        binaryen.none,
        binaryen.none
    );

    const DESIRED_SIZE = enhanced_local(mod, 0);
    // prettier-ignore
    const arena_heap_malloc = mod.block(null, [
        mod.if(
            i32.ge_u(
                i32.add(DESIRED_SIZE.get(), i32.add(ARENA_HEAP_OFFSET.get(), ARENA_HEAP_POINTER.get())),
                i32.mul(mod.memory.size("main_memory"), i32.const(PAGE_SIZE))),
            mod.block(null, [mod.memory.grow(mod.memory.size("main_memory"), "main_memory"), mod.call("$update_dataview", [], binaryen.none)])),

        ARENA_HEAP_OFFSET.set(
            i32.add(DESIRED_SIZE.get(), DESIRED_SIZE.tee(ARENA_HEAP_OFFSET.get()))),

        i32.add(DESIRED_SIZE.get(), ARENA_HEAP_POINTER.get())
    ]);
    mod.addFunction(
        "arena_heap_malloc",
        binaryen.createType([binaryen.i32]),
        binaryen.i32,
        [],
        arena_heap_malloc
    );

    const arena_heap_reset = mod.block(null, [ARENA_HEAP_OFFSET.set(i32.const(0))]);
    mod.addFunction("arena_heap_reset", binaryen.none, binaryen.none, [], arena_heap_reset);
}
