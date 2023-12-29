import binaryen from "binaryen";
import {
    Context,
    ExpressionInformation,
    FunctionInformation,
    InstanceTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import {
    AllocationLocation,
    Array,
    LinearMemoryLocation,
    MiteType,
    Primitive,
    Struct
} from "./type_classes.js";
import { TypeIdentifier } from "../types/nodes.js";

export const STACK_POINTER = "__stack_pointer";
export const ARENA_HEAP_POINTER = "__arena_heap_pointer";
export const ARENA_HEAP_OFFSET = "__arena_heap_pointer_offset";
export const JS_HEAP_POINTER = "__js_heap_pointer";

export function updateExpected(ctx: Context, expected: Context["expected"]) {
    return { ...ctx, expected };
}

export function bigintToLowAndHigh(num: bigint | number): [number, number] {
    if (typeof num === "number") num = BigInt(Math.floor(num));
    num = BigInt.asUintN(64, num);
    return [Number(num & 0xffffffffn), Number(num >> 32n)];
}

export function lookForVariable(ctx: Context, name: string): MiteType {
    const variable = ctx.variables.get(name);
    if (!variable) throw new Error(`Unknown variable: ${name}`);
    return variable;
}

export function createMiteType(
    ctx: Context,
    type: InstanceTypeInformation,
    address_or_local: Primitive | number
): MiteType {
    if (type.classification === "primitive") {
        if (typeof address_or_local !== "number") {
            return new Primitive(ctx, type, AllocationLocation.Arena, address_or_local.get());
        } else {
            return new Primitive(ctx, type, AllocationLocation.Local, address_or_local);
        }
    } else if (type.classification === "struct") {
        if (typeof address_or_local === "number") {
            address_or_local = new Primitive(
                ctx,
                ctx.types.i32,
                AllocationLocation.Local,
                address_or_local
            );
        }
        return new Struct(ctx, type, address_or_local);
    } else if (type.classification === "array") {
        if (typeof address_or_local === "number") {
            address_or_local = new Primitive(
                ctx,
                ctx.types.i32,
                AllocationLocation.Local,
                address_or_local
            );
        }
        return new Array(ctx, type, address_or_local);
    } else {
        throw new Error(`Unknown type: ${type}`);
    }
}

// converts a mite type to binaryen type (for parameter or return type)
export function typeInformationToBinaryen(type: TypeInformation) {
    if (type.classification === "primitive") {
        return Primitive.primitiveToBinaryen.get(type.name)!;
    }
    return binaryen.i32;
}

export function miteSignatureToBinaryenSignature(
    ctx: Context,
    name: string,
    variables: TypeInformation[],
    body: binaryen.ExpressionRef
): binaryen.ExpressionRef {
    const { params, results, stack_frame_size } = ctx.current_function;

    const binaryen_parameters_untyped = params.map(typeInformationToBinaryen);
    const binaryen_parameters = binaryen.createType(binaryen_parameters_untyped);
    const binaryen_return_type = typeInformationToBinaryen(results);
    const binaryen_variables = variables.map(typeInformationToBinaryen);

    const block = ctx.mod.block(null, [
        ctx.mod.global.set(
            STACK_POINTER,
            ctx.mod.i32.sub(
                ctx.mod.global.get(STACK_POINTER, binaryen.i32),
                ctx.mod.i32.const(stack_frame_size)
            )
        ),
        ctx.variables.get("Local Stack Pointer")!.set({
            ref: ctx.mod.global.get(STACK_POINTER, binaryen.i32),
            expression: binaryen.ExpressionIds.GlobalGet,
            type: ctx.types.i32
        }).ref,
        body,
        ctx.mod.global.set(
            STACK_POINTER,
            ctx.mod.i32.add(
                ctx.mod.global.get(STACK_POINTER, binaryen.i32),
                ctx.mod.i32.const(stack_frame_size)
            )
        )
    ]);

    return ctx.mod.addFunction(
        name,
        binaryen_parameters,
        binaryen_return_type,
        binaryen_variables,
        block
    );
}

export function constant(
    ctx: Context,
    value: number,
    type: "i32" | "i64" = "i32"
): ExpressionInformation {
    const ref =
        type === "i32" ? ctx.mod.i32.const(value) : ctx.mod.i64.const(...bigintToLowAndHigh(value));
    return {
        ref,
        type: ctx.types[type],
        expression: binaryen.ExpressionIds.Const
    };
}

export function rvalue(ctx: Context, array: ExpressionInformation): Array;
export function rvalue(ctx: Context, struct: ExpressionInformation): Struct;
export function rvalue(ctx: Context, expression: ExpressionInformation): Struct | Array {
    if (expression.type.classification === "array")
        return new Array(ctx, expression.type, expression);
    if (expression.type.classification === "struct")
        return new Struct(ctx, expression.type, expression);
    throw new Error(`Cannot rvalue ${expression.type.classification}`);
}

export function newBlock(
    ctx: Context,
    cb: () => ExpressionInformation | void,
    { name = null, type }: { name?: string | null; type?: number } = {}
): ExpressionInformation {
    const parent_block = ctx.current_block;
    ctx.current_block = [];
    const expr = cb();
    if (expr) ctx.current_block.push(expr);
    const block = ctx.current_block;
    ctx.current_block = parent_block;

    if (block.length === 1 && !name) {
        return block[0];
    } else {
        return {
            ref: ctx.mod.block(
                name,
                block.map((x) => x.ref),
                type
            ),
            type: block.at(-1)?.type ?? ctx.types.void,
            expression: binaryen.ExpressionIds.Block
        };
    }
}

const array_regex = /\[(.*); ([0-9]*)\]/;
export function parseType(ctx: Context, type: TypeIdentifier): InstanceTypeInformation;
export function parseType(ctx: Context, type: string): InstanceTypeInformation;
export function parseType(ctx: Context, type: string | TypeIdentifier): InstanceTypeInformation {
    if (typeof type === "object") return parseType(ctx, type.name);
    let is_ref = false;
    if (type.startsWith("ref ")) {
        is_ref = true;
        type = type.slice("ref ".length);
    }
    let location = undefined;
    for (const _place in AllocationLocation) {
        const place = `${_place} `;
        if (type.startsWith(place)) {
            location = AllocationLocation[_place as keyof typeof AllocationLocation];
            type = type.slice(place.length);
        }
    }

    if (type in ctx.types) {
        const base_type = ctx.types[type];
        if (base_type.classification === "primitive") {
            if (is_ref) throw new Error(`Cannot make primitive ${type} a ref`);
            return {
                ...base_type,
                location: location ?? AllocationLocation.Local,
                immutable: false
            };
        } else {
            return {
                ...base_type,
                is_ref,
                location: (location as LinearMemoryLocation) ?? AllocationLocation.Arena,
                immutable: false
            };
        }
    }

    if (array_regex.test(type)) {
        const [_, element_type, str_length] = array_regex.exec(type)!;
        const length = Number(str_length);

        return {
            classification: "array",
            name: type,
            element_type: parseType(ctx, element_type),
            length,
            sizeof: ctx.types[element_type].sizeof * length,
            is_ref,
            location: (location as LinearMemoryLocation) ?? AllocationLocation.Arena,
            immutable: false
        };
    }
    throw new Error(`Unknown type: ${type}`);
}

// export function createVariable(
//     ctx: Context,
//     type: InstancePrimitiveTypeInformation,
//     location?: LinearMemoryLocation,
//     initializer?: Primitive
// ): Primitive;
// export function createVariable(
//     ctx: Context,
//     type: InstanceStructTypeInformation,
//     location?: LinearMemoryLocation,
//     initializer?: Primitive
// ): Struct;
// export function createVariable(
//     ctx: Context,
//     type: InstanceArrayTypeInformation,
//     location?: LinearMemoryLocation,
//     initializer?: Primitive
// ): Array;
export function createVariable(
    ctx: Context,
    type: InstanceTypeInformation,
    location: LinearMemoryLocation = AllocationLocation.Arena,
    initializer?: Primitive
): MiteType {
    if (type.classification === "struct") {
        initializer ??= allocate(ctx, type.sizeof, location);
        return createMiteType(ctx, type, initializer);
    } else if (type.classification === "array") {
        initializer ??= allocate(ctx, type.sizeof, location);
        return createMiteType(ctx, type, initializer);
    } else {
        const variable = createMiteType(ctx, type, ctx.current_function.local_count++);
        if (initializer) ctx.current_block.push(variable.set(initializer.get()));
        return variable;
    }
}

export function callFunction(
    ctx: Context,
    function_name: string,
    { params, results }: FunctionInformation,
    args: ExpressionInformation[]
): ExpressionInformation {
    if (results.classification === "primitive") {
        return {
            ref: ctx.mod.call(
                function_name,
                args.map((arg) => arg.ref),
                typeInformationToBinaryen(results)
            ),
            type: results,
            expression: binaryen.ExpressionIds.Call
        };
    } else {
        const variable = createVariable(ctx, results);
        ctx.current_block.push({
            ref: ctx.mod.call(
                function_name,
                [variable.get().ref, ...args.map((arg) => arg.ref)],
                binaryen.none
            ),
            type: Primitive.primitives.get("void")!,
            expression: binaryen.ExpressionIds.Call
        });
        return variable.get();
    }
}

function stackAllocation(ctx: Context, size: number): ExpressionInformation {
    const ref = ctx.mod.i32.add(
        lookForVariable(ctx, "Local Stack Pointer").get().ref,
        ctx.mod.i32.const(ctx.current_function.stack_frame_size)
    );
    ctx.current_function.stack_frame_size += size;

    return { ref, expression: binaryen.ExpressionIds.Binary, type: ctx.types.i32 };
}

function heapAllocation(ctx: Context, size: number): Primitive {
    const ref = ctx.mod.call("arena_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32);
    const allocation = createVariable(ctx, ctx.types.i32, AllocationLocation.Arena, {
        ref,
        expression: binaryen.ExpressionIds.Call,
        type: ctx.types.i32
    });
    ctx.variables.set(`Arena Allocation ${ctx.variables.size}`, allocation);

    return allocation;
}

function jsAllocation(ctx: Context, size: number): Primitive {
    const ref = ctx.mod.call("js_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32);
    return { ref, expression: binaryen.ExpressionIds.Call, type: ctx.types.i32 };
}

export function allocate(ctx: Context, size: number, location: LinearMemoryLocation): Primitive {
    switch (location) {
        case AllocationLocation.Arena:
            return heapAllocation(ctx, size);
        case AllocationLocation.JS:
            return jsAllocation(ctx, size);
    }
}
