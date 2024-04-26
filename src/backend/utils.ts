import binaryen from "binaryen";
import {
    Context,
    FunctionInformation,
    InstanceArrayTypeInformation,
    InstanceTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import {
    Array_,
    LinearMemoryPrimitive,
    LocalPrimitive,
    MiteType,
    Pointer,
    Primitive,
    Struct,
    TransientPrimitive
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
    address_or_local: MiteType | number
): MiteType {
    if (typeof address_or_local === "number") {
        if (type.classification === "primitive") {
            return new LocalPrimitive(ctx, type, address_or_local);
        } else {
            const local = new LocalPrimitive(
                ctx,
                Primitive.primitives.get("u32")!,
                address_or_local
            );
            if (type.classification === "array") {
                return new Array_(ctx, type, new Pointer(local));
            } else if (type.classification === "struct") {
                return new Struct(ctx, type, new Pointer(local));
            }
        }
    } else {
        if (type.classification === "primitive") {
            return new LinearMemoryPrimitive(ctx, type, address_or_local);
        } else {
            if (type.classification === "array") {
                return new Array_(ctx, type, new Pointer(address_or_local.get()));
            } else if (type.classification === "struct") {
                return new Struct(ctx, type, new Pointer(address_or_local.get()));
            }
        }
    }
    throw new Error("Unreachable");
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
        return new TransientPrimitive(ctx, ctx.types.void, ctx.mod.nop());
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
export function parseType(ctx: Context, type: string): InstanceTypeInformation;
export function parseType(ctx: Context, type: string | TypeIdentifier): InstanceTypeInformation {
    if (typeof type === "object") return parseType(ctx, type.name);
    let is_ref = false;
    if (type.startsWith("ref ")) {
        is_ref = true;
        type = type.slice("ref ".length);
    }

    if (type in ctx.types) {
        const base_type = ctx.types[type];
        if (base_type.classification === "primitive") {
            if (is_ref) throw new Error(`Cannot make primitive ${type} a ref`);
            return {
                ...base_type,
                is_ref: false
            };
        } else {
            return {
                ...base_type,
                is_ref
            };
        }
    }

    if (array_regex.test(type) || fat_regex.test(type)) {
        const [_, element_type, str_length] = array_regex.exec(type) ?? [
            "",
            ...fat_regex.exec(type)!
        ];

        const length = Number(str_length);
        return {
            classification: "array",
            name: type,
            element_type: parseType(ctx, element_type),
            length,
            sizeof: ctx.types[element_type].sizeof * length + 4,
            is_ref
        };
    }
    throw new Error(`Unknown type: ${type}`);
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

export function allocate(ctx: Context, type: InstanceTypeInformation, size: number): Primitive {
    return new TransientPrimitive(
        ctx,
        ctx.types.u32,
        ctx.mod.call("arena_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32)
    );
}

export function toReturnType(
    ctx: Context,
    result: InstanceTypeInformation,
    result_expr: binaryen.ExpressionRef
): MiteType {
    const ptr = new TransientPrimitive(
        ctx,
        result.classification === "primitive" ? result : ctx.types.u32,
        result_expr
    );
    if (result.classification === "primitive") {
        return ptr;
    } else if (result.classification === "struct") {
        return new Struct(ctx, result, new Pointer(ptr));
    } else if (result.classification === "array") {
        return new Array_(ctx, result, new Pointer(ptr));
    } else {
        return result;
    }
}

export function constructArray(ctx: Context, type: InstanceArrayTypeInformation): MiteType {
    const address = allocate(ctx, type.element_type, type.sizeof);

    ctx.current_block.push(
        new TransientPrimitive(
            ctx,
            ctx.types.i32,
            ctx.mod.i32.store(
                0,
                0,
                address.get_expression_ref(),
                ctx.mod.i32.const(type.length ?? 0)
            )
        )
    );

    return new Array_(ctx, type, new Pointer(address));
}
