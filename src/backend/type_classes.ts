/*
    Wrappers for ctx.mod operations to enable easier interop between types

    example: setting variable value for an i32 would just be ctx.mod.local.set(idx, value)
    but for a struct attribute it might be ctx.mod.i32.store(ptr, value)
    or for a regular struct it might be ctx.mod.local.set(idx, ptr)

    these will be passed around instead of raw stuff now
    - i.e. VariableInformation should have a MiteType instead of a raw binaryen.Type i think
*/

import binaryen from "binaryen";
import {
    ArrayTypeInformation,
    Context,
    ExpressionInformation,
    StructTypeInformation,
    TypeInformation
} from "../types/code_gen.js";
import { createMiteType } from "./utils.js";

export enum AllocationLocation {
    Local,
    LinearMemory,
    Table
}

export enum LinearMemoryLocation {
    Stack = "stack",
    Heap = "heap",
    JS = "js"
}

export abstract class MiteType {
    // get the value
    abstract get(): ExpressionInformation;
    // set the value
    abstract set(value: ExpressionInformation): ExpressionInformation;
    // access with . operator
    abstract access(accessor: string): MiteType;
    // access with [] operator (this is going to have to be split into two like the above)
    abstract index(index: ExpressionInformation): MiteType;
    // call (todo for funcrefs)
    // abstract call(args: ExpressionInformation[]): ExpressionInformation;
    abstract sizeof(): number;
    abstract type: TypeInformation;
}

export class Primitive implements MiteType {
    static primitiveToBinaryen = new Map([
        ["void", binaryen.none],
        ["i32", binaryen.i32],
        ["i64", binaryen.i64],
        ["u32", binaryen.i32],
        ["u64", binaryen.i64],
        ["f32", binaryen.f32],
        ["f64", binaryen.f64],
        ["i8x16", binaryen.v128],
        ["u8x16", binaryen.v128],
        ["i16x8", binaryen.v128],
        ["u16x8", binaryen.v128],
        ["i32x4", binaryen.v128],
        ["u32x4", binaryen.v128],
        ["f32x4", binaryen.v128],
        ["i64x2", binaryen.v128],
        ["u64x2", binaryen.v128],
        ["f64x2", binaryen.v128]
    ]);
    static primitives = new Map<string, TypeInformation>([
        ["void", { classification: "primitive", name: "void", sizeof: 0 }],
        ["i32", { classification: "primitive", name: "i32", sizeof: 4 }],
        ["i64", { classification: "primitive", name: "i64", sizeof: 8 }],
        ["u32", { classification: "primitive", name: "u32", sizeof: 4 }],
        ["u64", { classification: "primitive", name: "u64", sizeof: 8 }],
        ["f32", { classification: "primitive", name: "f32", sizeof: 4 }],
        ["f64", { classification: "primitive", name: "f64", sizeof: 8 }],
        ["v128", { classification: "primitive", name: "v128", sizeof: 16 }],
        ["i8x16", { classification: "primitive", name: "i8x16", sizeof: 16 }],
        ["u8x16", { classification: "primitive", name: "u8x16", sizeof: 16 }],
        ["i16x8", { classification: "primitive", name: "i16x8", sizeof: 16 }],
        ["u16x8", { classification: "primitive", name: "u16x8", sizeof: 16 }],
        ["i32x4", { classification: "primitive", name: "i32x4", sizeof: 16 }],
        ["u32x4", { classification: "primitive", name: "u32x4", sizeof: 16 }],
        ["f32x4", { classification: "primitive", name: "f32x4", sizeof: 16 }],
        ["i64x2", { classification: "primitive", name: "i64x2", sizeof: 16 }],
        ["u64x2", { classification: "primitive", name: "u64x2", sizeof: 16 }],
        ["f64x2", { classification: "primitive", name: "f64x2", sizeof: 16 }]
    ]);
    static sizeof(type: string) {
        if (!Primitive.primitives.has(type)) throw new Error(`Invalid primitive type ${type}`);
        return Primitive.primitives.get(type)!.sizeof;
    }
    private binaryenType: binaryen.Type;
    private get pointer(): ExpressionInformation {
        if (typeof this.local_index_or_pointer === "number") throw new Error("unreachable");
        return {
            ...this.local_index_or_pointer,
            ref: this.ctx.mod.copyExpression(this.local_index_or_pointer.ref)
        };
    }
    private get local_index(): number {
        if (typeof this.local_index_or_pointer === "number") return this.local_index_or_pointer;
        throw new Error("unreachable");
    }

    public constructor(
        ctx: Context,
        type: TypeInformation,
        allocation_location: AllocationLocation.LinearMemory,
        pointer: ExpressionInformation
    );
    public constructor(
        ctx: Context,
        type: TypeInformation,
        allocation_location: AllocationLocation.Local,
        local_index: number
    );
    constructor(
        private ctx: Context,
        public type: TypeInformation,
        private allocation_location: AllocationLocation.Local | AllocationLocation.LinearMemory,
        // if allocation_location is Local, this is the local index
        // if allocation_location is LinearMemory, this is the pointer (possibly to the start of a parent struct)
        private local_index_or_pointer: number | ExpressionInformation
    ) {
        if (
            allocation_location === AllocationLocation.Local &&
            typeof local_index_or_pointer !== "number"
        ) {
            throw new Error("Local allocation must have a local index");
        } else if (
            allocation_location === AllocationLocation.LinearMemory &&
            typeof local_index_or_pointer === "number"
        ) {
            throw new Error("Linear memory allocation must have a pointer");
        }
        if (!Primitive.primitiveToBinaryen.has(type.name))
            throw new Error(`Invalid primitive type ${type.name}`);

        this.binaryenType = Primitive.primitiveToBinaryen.get(type.name)!;
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(Primitive.sizeof(this.type.name));
    }

    get(): ExpressionInformation {
        if (this.allocation_location === AllocationLocation.Local) {
            return {
                expression: binaryen.ExpressionIds.LocalGet,
                ref: this.ctx.mod.local.get(this.local_index, this.binaryenType),
                type: this.type
            };
        } else {
            let ref;
            if (this.binaryenType === binaryen.i32) {
                ref = this.ctx.mod.i32.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.i64) {
                ref = this.ctx.mod.i64.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.f32) {
                ref = this.ctx.mod.f32.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.f64) {
                ref = this.ctx.mod.f64.load(0, 0, this.pointer.ref, "main_memory");
            } else if (this.binaryenType === binaryen.v128) {
                ref = this.ctx.mod.v128.load(0, 0, this.pointer.ref, "main_memory");
            } else {
                throw new Error("unreachable");
            }
            return {
                expression: binaryen.ExpressionIds.Load,
                ref,
                type: this.type
            };
        }
    }

    set(value: ExpressionInformation): ExpressionInformation {
        if (this.allocation_location === AllocationLocation.Local) {
            return {
                expression: binaryen.ExpressionIds.LocalSet,
                ref: this.ctx.mod.local.tee(this.local_index, value.ref, this.binaryenType),
                type: this.type
            };
        } else {
            let ref;
            // replicate tee behavior
            // TODO: ensure binaryen optimizes out the extra load
            if (this.binaryenType === binaryen.i32) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.i32.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.i32.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.i64) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.i64.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.i64.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.f32) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.f32.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.f32.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.f64) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.f64.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.f64.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else if (this.binaryenType === binaryen.v128) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.v128.store(0, 0, this.pointer.ref, value.ref, "main_memory"),
                    this.ctx.mod.v128.load(0, 0, this.pointer.ref, "main_memory")
                ]);
            } else {
                throw new Error("unreachable");
            }
            return {
                expression: binaryen.ExpressionIds.Block,
                ref,
                type: this.type
            };
        }
    }

    access(accessor: string): MiteType {
        throw new Error("Unable to access properties of a primitive.");
    }

    index(index: ExpressionInformation): MiteType {
        throw new Error("Unable to access indices of a primitive.");
    }
}

export class Struct implements MiteType {
    constructor(
        private ctx: Context,
        public type: StructTypeInformation,
        private pointer: ExpressionInformation
    ) {}

    get(): ExpressionInformation {
        return {
            expression: binaryen.ExpressionIds.Binary,
            type: this.type,
            ref: this.ctx.mod.copyExpression(this.pointer.ref)
        };
    }

    set(value: ExpressionInformation): ExpressionInformation {
        if (value.type.name !== this.type.name)
            throw new Error(`Unable to assign ${value.type.name} to ${this.type.name}`);

        const assignment = this.ctx.mod.memory.copy(
            this.get().ref,
            value.ref,
            this.sizeof(),
            "main_memory",
            "main_memory"
        );

        return {
            expression: binaryen.ExpressionIds.MemoryCopy,
            ref: assignment,
            type: Primitive.primitives.get("void")!
        };
    }

    access(accessor: string): MiteType {
        if (!this.type.fields.has(accessor))
            throw new Error(`Struct ${this.type.name} does not have field ${accessor}`);
        const field = this.type.fields.get(accessor)!;

        return createMiteType(this.ctx, field.type, {
            ref: this.ctx.mod.i32.add(this.pointer.ref, this.ctx.mod.i32.const(field.offset)),
            expression: binaryen.ExpressionIds.Binary,
            type: field.type
        });
    }

    index(index: ExpressionInformation): MiteType {
        throw new Error("Unable to access indices of a struct.");
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(this.type.sizeof);
    }
}

export class Array implements MiteType {
    constructor(
        private ctx: Context,
        public type: ArrayTypeInformation,
        private pointer: ExpressionInformation
    ) {}

    get(): ExpressionInformation {
        return {
            expression: binaryen.ExpressionIds.Binary,
            type: this.type,
            ref: this.ctx.mod.copyExpression(this.pointer.ref)
        };
    }

    set(value: ExpressionInformation): ExpressionInformation {
        if (value.type.name !== this.type.name)
            throw new Error(`Unable to assign ${value.type.name} to ${this.type.name}`);

        const assignment = this.ctx.mod.memory.copy(
            this.get().ref,
            value.ref,
            this.sizeof(),
            "main_memory",
            "main_memory"
        );

        return {
            expression: binaryen.ExpressionIds.MemoryCopy,
            ref: assignment,
            type: Primitive.primitives.get("void")!
        };
    }

    access(accessor: string): MiteType {
        throw new Error("Unable to access properties of an array.");
    }

    index(index: ExpressionInformation): MiteType {
        if (index.type.name !== "i32")
            throw new Error(`Array index must be an i32, not ${index.type.name}`);

        return createMiteType(this.ctx, this.type.element_type, {
            ref: this.ctx.mod.i32.add(
                this.pointer.ref,
                this.ctx.mod.i32.mul(
                    index.ref,
                    this.ctx.mod.i32.const(this.type.element_type.sizeof)
                )
            ),
            expression: binaryen.ExpressionIds.Binary,
            type: this.type.element_type
        });
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(this.type.sizeof);
    }
}

// funcref, externref
// export class Reference implements MiteType {}
