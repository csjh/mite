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
    const { i32, v128, i8x16 } = mod;

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

    const STRING_1 = enhanced_local(mod, 0);
    const STRING_2 = enhanced_local(mod, 1);
    const STRING_OUT = enhanced_local(mod, 2);
    // prettier-ignore
    const string_concat = mod.block(null, [
        STRING_OUT.set(
            mod.call(
                "arena_heap_malloc",
                [i32.add(STRING_1.deref.get(), STRING_2.deref.get())],
                binaryen.i32)),

        STRING_OUT.deref.set(i32.add(STRING_1.deref.get(), STRING_2.deref.get())),

        mod.memory.copy(
            i32.add(STRING_OUT.get(), i32.const(4)),
            i32.add(STRING_1.get(), i32.const(4)),
            STRING_1.deref.get(),
            "main_memory",
            "main_memory"),
        mod.memory.copy(
            i32.add(STRING_OUT.get(), i32.add(i32.const(4), STRING_1.deref.get())),
            i32.add(STRING_2.get(), i32.const(4)),
            STRING_2.deref.get(),
            "main_memory",
            "main_memory"),

        STRING_OUT.get()
    ]);

    mod.addFunction(
        "String.concat",
        binaryen.createType([binaryen.i32, binaryen.i32]),
        binaryen.i32,
        [binaryen.i32, binaryen.i32, binaryen.i32],
        string_concat
    );

    const LENGTH = enhanced_local(mod, 2);
    const CTZ = enhanced_local(mod, 3);
    const IF_ALL_ELSE = enhanced_local(mod, 4);
    // prettier-ignore
    const string_cmp = mod.block(null, [
        // return value if they're both equal up to shorter length
        // this probably isn't the best way to do this
        IF_ALL_ELSE.set(i32.sub(STRING_1.deref.get(), STRING_2.deref.get())),

        LENGTH.set(
            mod.select(
                i32.lt_u(STRING_1.deref.get(), STRING_2.deref.get()),
                STRING_1.deref.get(),
                STRING_2.deref.get())),

        mod.if(
            i32.ge_u(LENGTH.get(), i32.const(16)),
            mod.loop(
                "cmp_loop",
                mod.block(null, [
                    mod.if(
                        // todo: check if it's faster to use v128.any_true and bitmask inside the if
                        CTZ.tee(
                            i8x16.bitmask(
                                i8x16.ne(
                                    v128.load(4, 0, STRING_1.get(), "main_memory"),
                                    v128.load(4, 0, STRING_2.get(), "main_memory")))),
                        mod.block(null, [
                            mod.return(
                                i32.sub(
                                    i32.load8_u(4, 0, i32.add(STRING_1.get(), CTZ.tee(i32.ctz(CTZ.get()))), "main_memory"),
                                    i32.load8_u(4, 0, i32.add(STRING_2.get(), CTZ.get(                  )), "main_memory")))])),

                    STRING_1.set(i32.add(STRING_1.get(), i32.const(16))),
                    STRING_2.set(i32.add(STRING_2.get(), i32.const(16))),

                    mod.br_if("cmp_loop",
                        i32.ge_u(
                            LENGTH.tee(i32.sub(LENGTH.get(), i32.const(16))),
                            i32.const(16)))]))),

        CTZ.set(
            i8x16.bitmask(
                v128.and(
                    i8x16.ne(
                        v128.load(4, 0, STRING_1.get(), "main_memory"),
                        v128.load(4, 0, STRING_2.get(), "main_memory")),
                    // only compare up to LENGTH
                    i8x16.lt_u(
                        v128.const(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])),
                        i8x16.splat(LENGTH.get()))))),

        mod.select(
            CTZ.get(),
            i32.sub(
                // using LENGTH here because it's unused after, and CLZ can't be overwritten (select condition runs after args)
                i32.load8_u(4, 0, i32.add(STRING_1.get(), LENGTH.tee(i32.ctz(CTZ.get()))), "main_memory"),
                i32.load8_u(4, 0, i32.add(STRING_2.get(), LENGTH.get(                  )), "main_memory")),
            IF_ALL_ELSE.get()),
    ]);

    mod.addFunction(
        "String.cmp",
        binaryen.createType([binaryen.i32, binaryen.i32]),
        binaryen.i32,
        [binaryen.i32, binaryen.i32, binaryen.i32],
        string_cmp
    );

    mod.addFunctionExport("String.cmp", "cmp");
}
