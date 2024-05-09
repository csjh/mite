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
    IndirectFunction,
    LinearMemoryPrimitive,
    LocalPrimitive,
    MiteType,
    Pointer,
    Primitive,
    Struct,
    TransientPrimitive
} from "./type_classes.js";
import { TypeIdentifier } from "../types/nodes.js";

export const ARENA_HEAP_POINTER = "__arena_heap_pointer";
export const ARENA_HEAP_OFFSET = "__arena_heap_pointer_offset";
export const VIRTUALIZED_FUNCTIONS = "virtualized_functions";

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
            } else if (type.classification === "function") {
                return new IndirectFunction(ctx, type, new Pointer(local));
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
            } else if (type.classification === "function") {
                return new IndirectFunction(ctx, type, new Pointer(address_or_local.get()));
            }
        }
    }

    // @ts-expect-error unreachable probably
    type.classification;
    return undefined as never;
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
    { params, results }: FunctionInformation,
    name: string,
    variables: TypeInformation[],
    body: binaryen.ExpressionRef
): binaryen.ExpressionRef {
    const binaryen_parameters_untyped = params.map((x) => typeInformationToBinaryen(x.type));
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
    const scope_id = crypto.randomUUID();

    const parent_block = ctx.current_block;
    const parent_scope = ctx.variables;
    ctx.variables = new Map(parent_scope);
    ctx.current_block = [];
    const expr = cb();
    if (expr) ctx.current_block.push(expr);
    const block = ctx.current_block;
    ctx.current_block = parent_block;

    for (const [key, value] of ctx.variables) {
        if (!parent_scope.has(key)) {
            parent_scope.set(`${key} ${scope_id}`, value);
        }
    }
    ctx.variables = parent_scope;

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
        return fromExpressionRef(ctx, ret, blocked);
    }
}

function isCtx(obj: Context | Context["types"]): obj is Context {
    return !("i32" in obj);
}

const array_regex = /\[(.*); ([0-9]*)\]/;
const fat_regex = /\[(.*)\]/;
export function parseType(
    ctx: Context | Context["types"],
    type: string | TypeIdentifier
): InstanceTypeInformation {
    if (isCtx(ctx)) return parseType(ctx.types, type);

    let is_ref = typeof type === "object" ? !!type.isRef : false;
    if (typeof type === "object") type = type.name;
    if (type.startsWith("ref ")) {
        is_ref = true;
        type = type.slice("ref ".length);
    }

    // (x: int, y: int) => int
    if (type.startsWith("(")) {
        const [params_str, results_str] = type.split(" => ");
        const params = params_str
            .slice(1, -1)
            .split(", ")
            .map((x) => {
                const [name, type] = x.split(": ", 2);
                return {
                    name,
                    type: parseType(ctx, type)
                };
            });
        const results = parseType(ctx, results_str);
        return {
            classification: "function",
            name: type, // not really used
            implementation: { params, results },
            is_ref,
            sizeof: 8
        };
    }

    if (type in ctx) {
        const base_type = ctx[type];
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
            sizeof: ctx[element_type].sizeof * length + 4,
            is_ref
        };
    }
    throw new Error(`Unknown type: ${type}`);
}

export function allocate(ctx: Context, type: InstanceTypeInformation, size: number): Pointer {
    const allocation = new TransientPrimitive(
        ctx,
        Pointer.type,
        ctx.mod.call("arena_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32)
    );

    const local = createMiteType(ctx, Pointer.type, ctx.current_function.local_count++);
    ctx.variables.set(`AllocationInLocal${ctx.current_function.local_count - 1}`, local);
    ctx.current_block.push(local.set(allocation));

    return new Pointer(local as Primitive);
}

export function fromExpressionRef(
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
    } else if (result.classification === "function") {
        return new IndirectFunction(ctx, result, new Pointer(ptr));
    } else {
        return result;
    }
}

export function constructArray(ctx: Context, type: InstanceArrayTypeInformation): Pointer {
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

    return address;
}
