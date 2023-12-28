import binaryen from "binaryen";
import {
    BinaryOperator as BinaryenBinaryOperator,
    Context,
    ExpressionInformation,
    FunctionInformation,
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
import { BinaryOperator, TokenType } from "../types/tokens.js";
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

export function getBinaryOperator(
    ctx: Context,
    type: TypeInformation,
    operator: BinaryOperator
): BinaryenBinaryOperator {
    switch (operator) {
        case TokenType.PLUS:
            if (!ctx.operators[type.name].add) throw new Error(`Cannot add ${type.name}`);
            return ctx.operators[type.name].add!;
        case TokenType.MINUS:
            if (!ctx.operators[type.name].sub) throw new Error(`Cannot subtract ${type.name}`);
            return ctx.operators[type.name].sub!;
        case TokenType.STAR:
            if (!ctx.operators[type.name].mul) throw new Error(`Cannot multiply ${type.name}`);
            return ctx.operators[type.name].mul!;
        case TokenType.SLASH:
            if (!ctx.operators[type.name].div) throw new Error(`Cannot divide ${type.name}`);
            return ctx.operators[type.name].div!;
        case TokenType.EQUALS:
            if (!ctx.operators[type.name].eq)
                throw new Error(`Cannot check equality of ${type.name}`);
            return ctx.operators[type.name].eq!;
        case TokenType.NOT_EQUALS:
            if (!ctx.operators[type.name].ne)
                throw new Error(`Cannot check equality of ${type.name}`);
            return ctx.operators[type.name].ne!;
        case TokenType.LESS_THAN:
            if (!ctx.operators[type.name].lt) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].lt!;
        case TokenType.LESS_THAN_EQUALS:
            if (!ctx.operators[type.name].lte) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].lte!;
        case TokenType.GREATER_THAN:
            if (!ctx.operators[type.name].gt) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].gt!;
        case TokenType.GREATER_THAN_EQUALS:
            if (!ctx.operators[type.name].gte) throw new Error(`Cannot compare ${type.name}`);
            return ctx.operators[type.name].gte!;
        case TokenType.BITSHIFT_LEFT:
            if (!ctx.operators[type.name].shl) throw new Error(`Cannot shift ${type.name}`);
            return ctx.operators[type.name].shl!;
        case TokenType.BITSHIFT_RIGHT:
            if (!ctx.operators[type.name].shr) throw new Error(`Cannot shift ${type.name}`);
            return ctx.operators[type.name].shr!;
        case TokenType.MODULUS:
            if (!ctx.operators[type.name].mod) throw new Error(`Cannot mod ${type.name}`);
            return ctx.operators[type.name].mod!;
        case TokenType.BITWISE_OR:
            if (!ctx.operators[type.name].or) throw new Error(`Cannot bitwise or ${type.name}`);
            return ctx.operators[type.name].or!;
        case TokenType.BITWISE_XOR:
            if (!ctx.operators[type.name].xor) throw new Error(`Cannot bitwise xor ${type.name}`);
            return ctx.operators[type.name].xor!;
        case TokenType.BITWISE_AND:
            if (!ctx.operators[type.name].and) throw new Error(`Cannot bitwise and ${type.name}`);
            return ctx.operators[type.name].and!;
    }

    throw new Error(`Unknown operator: ${operator}`);
}

export function createMiteType(
    ctx: Context,
    type: TypeInformation,
    value_or_index: ExpressionInformation | number
): MiteType {
    if (type.classification === "primitive") {
        if (typeof value_or_index !== "number") {
            return new Primitive(ctx, type, AllocationLocation.LinearMemory, value_or_index);
        } else {
            return new Primitive(ctx, type, AllocationLocation.Local, value_or_index);
        }
    } else if (type.classification === "struct") {
        if (typeof value_or_index === "number") {
            value_or_index = {
                ref: ctx.mod.local.get(value_or_index, binaryen.i32),
                type,
                expression: binaryen.ExpressionIds.LocalGet
            };
        }
        return new Struct(ctx, type, value_or_index);
    } else if (type.classification === "array") {
        if (typeof value_or_index === "number") {
            value_or_index = {
                ref: ctx.mod.local.get(value_or_index, binaryen.i32),
                type,
                expression: binaryen.ExpressionIds.LocalGet
            };
        }
        return new Array(ctx, type, value_or_index);
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
    const has_output_parameter = results.classification !== "primitive";

    const binaryen_parameters_untyped = params.map(typeInformationToBinaryen);
    const binaryen_parameters = binaryen.createType(
        has_output_parameter
            ? [binaryen.i32, ...binaryen_parameters_untyped]
            : binaryen_parameters_untyped
    );
    const binaryen_return_type = has_output_parameter
        ? binaryen.none
        : typeInformationToBinaryen(results);
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

export function wrapArray(ctx: Context, array: ExpressionInformation): Array {
    if (array.type.classification !== "array") throw new Error("Cannot wrap non-array");
    return new Array(ctx, array.type, array);
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
export function parseType(ctx: Context, type: TypeIdentifier): TypeInformation;
export function parseType(ctx: Context, type: string): TypeInformation;
export function parseType(ctx: Context, type: string | TypeIdentifier): TypeInformation {
    if (typeof type === "object") return parseType(ctx, type.name);
    if (type in ctx.types) return ctx.types[type];
    if (array_regex.test(type)) {
        const [_, element_type, str_length] = array_regex.exec(type)!;
        const length = Number(str_length);

        return (ctx.types[type] = {
            name: type,
            classification: "array",
            element_type: parseType(ctx, element_type),
            length,
            sizeof: ctx.types[element_type].sizeof * length
        });
    }
    throw new Error(`Unknown type: ${type}`);
}

export function createVariable(
    ctx: Context,
    type: TypeInformation,
    location: LinearMemoryLocation = AllocationLocation.Arena,
    initializer?: ExpressionInformation
): MiteType {
    if (type.classification === "struct") {
        initializer ??= allocate(ctx, type.sizeof, location);
        return createMiteType(ctx, type, initializer);
    } else if (type.classification === "array") {
        initializer ??= allocate(ctx, type.sizeof, location);
        return createMiteType(ctx, type, initializer);
    } else {
        const variable = createMiteType(ctx, type, ctx.current_function.local_count++);
        if (initializer) ctx.current_block.push(variable.set(initializer));
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

function heapAllocation(ctx: Context, size: number): ExpressionInformation {
    const ref = ctx.mod.call("arena_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32);
    const allocation = createVariable(ctx, ctx.types.i32, AllocationLocation.Arena, {
        ref,
        expression: binaryen.ExpressionIds.Call,
        type: ctx.types.i32
    });
    ctx.variables.set(`Arena Allocation ${ctx.variables.size}`, allocation);

    return allocation.get();
}

function jsAllocation(ctx: Context, size: number): ExpressionInformation {
    const ref = ctx.mod.call("js_heap_malloc", [ctx.mod.i32.const(size)], binaryen.i32);
    return { ref, expression: binaryen.ExpressionIds.Call, type: ctx.types.i32 };
}

export function allocate(ctx: Context, size: number, location: LinearMemoryLocation) {
    switch (location) {
        case AllocationLocation.Arena:
            return heapAllocation(ctx, size);
        case AllocationLocation.Stack:
            throw new Error("Cannot allocate structs on stack");
            return stackAllocation(ctx, size);
        case AllocationLocation.JS:
            return jsAllocation(ctx, size);
    }
}
