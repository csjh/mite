import binaryen from "binaryen";
import {
    Context,
    FunctionInformation,
    InstanceArrayTypeInformation,
    InstanceFunctionTypeInformation,
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
    String_,
    Struct,
    TransientPrimitive
} from "./type_classes.js";
import {
    ExportNamedDeclaration,
    FunctionDeclaration,
    Program,
    StructDeclaration,
    TypeIdentifier
} from "../types/nodes.js";

export const ARENA_HEAP_POINTER = "__arena_heap_pointer";
export const ARENA_HEAP_OFFSET = "__arena_heap_pointer_offset";
export const VIRTUALIZED_FUNCTIONS = "virtualized_functions";
export const FN_PTRS_START = "$fn_ptrs_start";
export const STRING_SECTION_START = "$string_section_start";

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
            const local = new LocalPrimitive(ctx, Pointer.type, address_or_local);
            if (type.classification === "array") {
                return new Array_(ctx, type, new Pointer(local));
            } else if (type.classification === "struct") {
                return new Struct(ctx, type, new Pointer(local));
            } else if (type.classification === "function") {
                return new IndirectFunction(ctx, type, new Pointer(local));
            } else if (type.classification === "string") {
                return new String_(ctx, new Pointer(local));
            }
        }
    } else {
        if (type.classification === "primitive") {
            return new LinearMemoryPrimitive(ctx, type, address_or_local);
        } else {
            const primitive =
                address_or_local instanceof Primitive ? address_or_local : address_or_local.get();

            if (type.classification === "array") {
                return new Array_(ctx, type, new Pointer(primitive));
            } else if (type.classification === "struct") {
                return new Struct(ctx, type, new Pointer(primitive));
            } else if (type.classification === "function") {
                return new IndirectFunction(ctx, type, new Pointer(primitive));
            } else if (type.classification === "string") {
                return new String_(ctx, new Pointer(primitive));
            }
        }
    }

    // @ts-expect-error unreachable probably
    type.classification;
    throw new Error(`Unknown type: ${type}`);
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

export function parseType(
    ctx: Context | Context["types"],
    type: TypeIdentifier
): InstanceTypeInformation {
    if (isCtx(ctx)) return parseType(ctx.types, type);

    const { isRef, _type } = type;

    // (x: int, y: int) => int
    if (_type.type === "Function") {
        const implementation = {
            params: _type.params.map((x) => ({
                name: x.name.name,
                type: parseType(ctx, x.typeAnnotation)
            })),
            results: parseType(ctx, _type.returnType)
        };

        return {
            classification: "function",
            name: `(${implementation.params.map((x) => `${x.name}: ${x.type.name}`).join(", ")}) => ${implementation.results.name}`,
            implementation,
            is_ref: isRef,
            sizeof: 8
        };
    } else if (_type.type === "Identifier") {
        const base_type = ctx[_type.name];
        if (base_type.classification === "string") {
            return String_.type;
        } else if (base_type.classification === "primitive") {
            if (type.isRef) throw new Error(`Cannot make primitive ${type} a ref`);
            return {
                ...base_type,
                is_ref: false
            };
        } else {
            return {
                ...base_type,
                is_ref: isRef
            };
        }
    } else if (_type.type === "Array") {
        const element_type = parseType(ctx, _type.elementType);
        return {
            classification: "array",
            name: `[${element_type.name}]`,
            element_type,
            length: _type.length,
            sizeof: _type.length ? element_type.sizeof * _type.length + 4 : 0,
            is_ref: isRef
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
        result.classification === "primitive" ? result : Pointer.type,
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
    } else if (result.classification === "string") {
        return new String_(ctx, new Pointer(ptr));
    } else {
        // @ts-expect-error unreachable
        result.classification;
        throw new Error(`Unknown type: ${result}`);
    }
}

export function constructArray(ctx: Context, type: InstanceArrayTypeInformation): Pointer {
    const address = allocate(ctx, type.element_type, type.sizeof);

    ctx.current_block.push(
        new TransientPrimitive(
            ctx,
            Pointer.type,
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

export function functionToSignature({
    implementation: fn
}: InstanceFunctionTypeInformation): string {
    return `${fn.params.map((y) => typeInformationToBinaryen(y.type)).join(",")}|${typeInformationToBinaryen(fn.results)}`;
}

function functionDeclarationToString(types: Context["types"], func: FunctionDeclaration): string[] {
    return func.params
        .map((x) => parseType(types, x.typeAnnotation))
        .filter((x): x is InstanceFunctionTypeInformation => x.classification === "function")
        .map(
            ({ implementation: x }) =>
                `${x.params.map((y) => typeInformationToBinaryen(y.type)).join(",")}|${typeInformationToBinaryen(x.results)}`
        );
}

export function getCallbacks(types: Context["types"], program: Program): string[] {
    const exports = program.body
        .filter(
            (x): x is ExportNamedDeclaration =>
                x.type === "ExportNamedDeclaration" && x.declaration.type === "FunctionDeclaration"
        )
        .map((x) => x.declaration as FunctionDeclaration);
    const methods = Object.fromEntries(
        program.body
            .filter((x): x is StructDeclaration => x.type === "StructDeclaration")
            .map((x) => [x.id.name, x.methods])
    );

    const function_callbacks = exports
        .flatMap((x) => functionDeclarationToString(types, x))
        .concat(
            Object.values(methods).flatMap((x) =>
                x.flatMap((y) => functionDeclarationToString(types, y))
            )
        );

    return Array.from(new Set(function_callbacks));
}

export function addDataSegment(
    ctx: Context,
    segment_name: string,
    memory_name: string,
    data: Uint8Array
) {
    // @ts-expect-error undocumented binaryen export
    const data_ptr = binaryen._malloc(data.length);
    // @ts-expect-error undocumented binaryen export
    new Uint8Array(binaryen.HEAPU8.buffer, data_ptr, data.length).set(data);
    // @ts-expect-error undocumented binaryen export
    binaryen._BinaryenAddDataSegment(
        ctx.mod.ptr,
        // @ts-expect-error undocumented binaryen export
        binaryen.stringToUTF8OnStack(segment_name),
        // @ts-expect-error undocumented binaryen export
        binaryen.stringToUTF8OnStack(memory_name),
        true,
        null,
        data_ptr,
        data.length
    );
    // @ts-expect-error undocumented binaryen export
    binaryen._free(data.byteOffset);
}

export function assumeStructs(types: Context["types"]): Context["types"] {
    return new Proxy(types, {
        get(target, p, receiver) {
            if (p in target) return Reflect.get(target, p, receiver);
            return {
                classification: "struct",
                name: p,
                sizeof: 0,
                fields: new Map(),
                methods: new Map(),
                is_ref: false
            };
        }
    });
}
