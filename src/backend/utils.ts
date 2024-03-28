import binaryen from "binaryen";
import {
    Context,
    FunctionInformation,
    InstancePrimitiveTypeInformation,
    InstanceTypeInformation,
    PrimitiveTypeInformation,
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
        return new Primitive(ctx, type, address_or_local);
    } else if (type.classification === "struct") {
        if (typeof address_or_local === "number") {
            address_or_local = new Primitive(
                ctx,
                adapt(ctx.types.u32, AllocationLocation.Local),
                address_or_local
            );
        }
        return new Struct(ctx, type, address_or_local);
    } else if (type.classification === "array") {
        if (typeof address_or_local === "number") {
            address_or_local = new Primitive(
                ctx,
                adapt(ctx.types.u32, AllocationLocation.Local),
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
    const { params, results } = ctx.current_function;

    const binaryen_parameters_untyped = params.map(typeInformationToBinaryen);
    const binaryen_parameters = binaryen.createType(binaryen_parameters_untyped);
    const binaryen_return_type = typeInformationToBinaryen(results);
    const binaryen_variables = variables.map(typeInformationToBinaryen);

    return ctx.mod.addFunction(
        name,
        binaryen_parameters,
        binaryen_return_type,
        binaryen_variables,
        body
    );
}

export function constant(ctx: Context, value: number, type: "i32" | "i64" = "i32"): Primitive {
    const ref =
        type === "i32" ? ctx.mod.i32.const(value) : ctx.mod.i64.const(...bigintToLowAndHigh(value));
    return transient(ctx, ctx.types[type], ref);
}

export function newBlock(
    ctx: Context,
    cb: () => MiteType | void,
    { name = null, type }: { name?: string | null; type?: number } = {}
): MiteType {
    const parent_block = ctx.current_block;
    ctx.current_block = [];
    const expr = cb();
    if (expr) ctx.current_block.push(expr);
    const block = ctx.current_block;
    ctx.current_block = parent_block;

    if (block.length === 0) {
        return transient(ctx, ctx.types.void, ctx.mod.nop());
    } else if (block.length === 1 && !name) {
        return block[0];
    } else {
        const ret = block.at(-1)!.type;
        const blocked = ctx.mod.block(
            name,
            block.map((x) => x.get_expression_ref()),
            type
        );
        return toReturnType(ctx, ret, blocked);
    }
}

const array_regex = /\[(.*); ([0-9]*)\]/;
const fat_regex = /\[(.*)\]/;
export function parseType(ctx: Context, type: TypeIdentifier): InstanceTypeInformation;
export function parseType(
    ctx: Context,
    type: string,
    location?: AllocationLocation
): InstanceTypeInformation;
export function parseType(
    ctx: Context,
    type: string | TypeIdentifier,
    location?: AllocationLocation
): InstanceTypeInformation {
    if (typeof type === "object") return parseType(ctx, type.name);
    let is_ref = false;
    if (type.startsWith("ref ")) {
        is_ref = true;
        type = type.slice("ref ".length);
    }

    if (!location) {
        for (const _place in AllocationLocation) {
            const place = `${_place} `;
            if (type.startsWith(place)) {
                location = AllocationLocation[_place as keyof typeof AllocationLocation];
                type = type.slice(place.length);
            }
        }
    }

    if (type in ctx.types) {
        const base_type = ctx.types[type];
        if (base_type.classification === "primitive") {
            if (is_ref) throw new Error(`Cannot make primitive ${type} a ref`);
            return {
                ...base_type,
                location: location ?? AllocationLocation.Local,
                immutable: false,
                is_ref: false
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

    if (array_regex.test(type) || fat_regex.test(type)) {
        const [_, element_type, str_length] = array_regex.exec(type) ?? [
            "",
            ...fat_regex.exec(type)!
        ];

        const length = Number(str_length);
        location ??= AllocationLocation.Arena;
        return {
            classification: "array",
            name: type,
            element_type: parseType(ctx, element_type, location),
            length,
            sizeof: ctx.types[element_type].sizeof * length,
            is_ref,
            location: location as LinearMemoryLocation,
            immutable: false
        };
    }
    throw new Error(`Unknown type: ${type}`);
}

export function createVariable(
    ctx: Context,
    type: InstanceTypeInformation,
    initializer?: Primitive,
    location: LinearMemoryLocation = AllocationLocation.Arena
): MiteType {
    if (type.classification === "struct") {
        initializer ??= allocate(ctx, type.sizeof, location);
        return createMiteType(ctx, { ...type, location }, initializer);
    } else if (type.classification === "array") {
        initializer ??= allocate(ctx, type.sizeof, location);
        return createMiteType(ctx, { ...type, location }, initializer);
    } else {
        const variable = createMiteType(
            ctx,
            { ...type, location: AllocationLocation.Local },
            ctx.current_function.local_count++
        );
        if (initializer) ctx.current_block.push(variable.set(initializer.get()));
        return variable;
    }
}

export function callFunction(
    ctx: Context,
    function_name: string,
    { params, results }: FunctionInformation,
    args: MiteType[]
): MiteType {
    const results_expr = ctx.mod.call(
        function_name,
        args.map((arg) => arg.get_expression_ref()),
        typeInformationToBinaryen(results)
    );
    return toReturnType(ctx, results, results_expr);
}

function heapAllocation(ctx: Context, size: number): Primitive {
    const ref = ctx.mod.call("arena_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32);
    const allocation = createVariable(
        ctx,
        adapt(ctx.types.u32, AllocationLocation.Local),
        transient(ctx, ctx.types.u32, ref)
    ) as Primitive;
    // ctx.variables.set(`Arena Allocation ${ctx.variables.size}`, allocation);

    return allocation;
}

function jsAllocation(ctx: Context, size: number): Primitive {
    const ref = ctx.mod.call("js_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32);
    const allocation = createVariable(
        ctx,
        adapt(ctx.types.u32, AllocationLocation.Local),
        transient(ctx, ctx.types.u32, ref)
    ) as Primitive;
    ctx.variables.set(`JS Allocation ${ctx.variables.size}`, allocation);

    return allocation;
}

export function allocate(ctx: Context, size: number, location: LinearMemoryLocation): Primitive {
    switch (location) {
        case AllocationLocation.Arena:
            return heapAllocation(ctx, size);
        case AllocationLocation.JS:
            return jsAllocation(ctx, size);
    }
}

export function transient(
    ctx: Context,
    type: PrimitiveTypeInformation,
    expression: binaryen.ExpressionRef
): Primitive {
    return new Primitive(ctx, adapt(type), expression);
}

export function adapt(
    type: PrimitiveTypeInformation,
    location: AllocationLocation = AllocationLocation.Transient
): InstancePrimitiveTypeInformation {
    return {
        ...type,
        location,
        is_ref: false,
        immutable: false
    };
}

export function toReturnType(
    ctx: Context,
    result: InstanceTypeInformation,
    result_expr: binaryen.ExpressionRef
): MiteType {
    if (result.classification === "primitive") {
        return new Primitive(ctx, adapt(result), result_expr);
    }
    return createMiteType(ctx, result, new Primitive(ctx, adapt(ctx.types.u32), result_expr));
}
