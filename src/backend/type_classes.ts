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
    Context,
    ExpressionInformation,
    StructTypeInformation,
    TypeInformation
} from "../types/code_gen.js";

export enum AllocationLocation {
    Local,
    LinearMemory,
    Table
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
        ["void", { classification: "primitive", name: "void" }],
        ["i32", { classification: "primitive", name: "i32" }],
        ["i64", { classification: "primitive", name: "i64" }],
        ["u32", { classification: "primitive", name: "u32" }],
        ["u64", { classification: "primitive", name: "u64" }],
        ["f32", { classification: "primitive", name: "f32" }],
        ["f64", { classification: "primitive", name: "f64" }],
        ["i8x16", { classification: "primitive", name: "i8x16" }],
        ["u8x16", { classification: "primitive", name: "u8x16" }],
        ["i16x8", { classification: "primitive", name: "i16x8" }],
        ["u16x8", { classification: "primitive", name: "u16x8" }],
        ["i32x4", { classification: "primitive", name: "i32x4" }],
        ["u32x4", { classification: "primitive", name: "u32x4" }],
        ["f32x4", { classification: "primitive", name: "f32x4" }],
        ["i64x2", { classification: "primitive", name: "i64x2" }],
        ["u64x2", { classification: "primitive", name: "u64x2" }],
        ["f64x2", { classification: "primitive", name: "f64x2" }]
    ]);
    static sizeof(type: string) {
        switch (Primitive.primitiveToBinaryen.get(type)) {
            case binaryen.none:
                return 0;
            case binaryen.i32:
            case binaryen.f32:
                return 4;
            case binaryen.i64:
            case binaryen.f64:
                return 8;
            case binaryen.v128:
                return 16;
            default:
                throw new Error("unreachable");
        }
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
        pointer: ExpressionInformation,
        offset: number
    );
    public constructor(
        ctx: Context,
        type: TypeInformation,
        allocation_location: AllocationLocation.Local,
        local_index: number,
        offset: number
    );
    constructor(
        private ctx: Context,
        public type: TypeInformation,
        private allocation_location: AllocationLocation.Local | AllocationLocation.LinearMemory,
        // if allocation_location is Local, this is the local index
        // if allocation_location is LinearMemory, this is the pointer (possibly to the start of a parent struct)
        private local_index_or_pointer: number | ExpressionInformation,
        // offset from local_index_or_pointer to this property (only applicable if allocation_location is LinearMemory)
        private offset: number
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
                ref = this.ctx.mod.i32.load(this.offset, 0, this.pointer.ref);
            } else if (this.binaryenType === binaryen.i64) {
                ref = this.ctx.mod.i64.load(this.offset, 0, this.pointer.ref);
            } else if (this.binaryenType === binaryen.f32) {
                ref = this.ctx.mod.f32.load(this.offset, 0, this.pointer.ref);
            } else if (this.binaryenType === binaryen.f64) {
                ref = this.ctx.mod.f64.load(this.offset, 0, this.pointer.ref);
            } else if (this.binaryenType === binaryen.v128) {
                ref = this.ctx.mod.v128.load(this.offset, 0, this.pointer.ref);
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
                    this.ctx.mod.i32.store(this.offset, 0, this.pointer.ref, value.ref),
                    this.ctx.mod.i32.load(this.offset, 0, this.pointer.ref)
                ]);
            } else if (this.binaryenType === binaryen.i64) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.i64.store(this.offset, 0, this.pointer.ref, value.ref),
                    this.ctx.mod.i64.load(this.offset, 0, this.pointer.ref)
                ]);
            } else if (this.binaryenType === binaryen.f32) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.f32.store(this.offset, 0, this.pointer.ref, value.ref),
                    this.ctx.mod.f32.load(this.offset, 0, this.pointer.ref)
                ]);
            } else if (this.binaryenType === binaryen.f64) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.f64.store(this.offset, 0, this.pointer.ref, value.ref),
                    this.ctx.mod.f64.load(this.offset, 0, this.pointer.ref)
                ]);
            } else if (this.binaryenType === binaryen.v128) {
                ref = this.ctx.mod.block(null, [
                    this.ctx.mod.v128.store(this.offset, 0, this.pointer.ref, value.ref),
                    this.ctx.mod.v128.load(this.offset, 0, this.pointer.ref)
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
    private get pointer(): ExpressionInformation {
        return {
            ...this._pointer,
            ref: this.ctx.mod.copyExpression(this._pointer.ref)
        };
    }

    constructor(
        private ctx: Context,
        public type: StructTypeInformation,
        // start of the "base" struct in memory
        // i.e. if we have struct A { i32 a; i32 b; } and struct B { A a; i32 c; }
        // then this would be the pointer to the start of A
        private _pointer: ExpressionInformation,
        // offset from _pointer to this propertty
        private _offset: number
    ) {}

    get(): ExpressionInformation {
        return {
            expression: binaryen.ExpressionIds.Binary,
            type: this.type,
            ref: this.ctx.mod.i32.add(
                this.ctx.mod.copyExpression(this._pointer.ref),
                this.ctx.mod.i32.const(this._offset)
            )
        };
    }

    set(value: ExpressionInformation): ExpressionInformation {
        if (value.type.name !== this.type.name)
            throw new Error(`Unable to assign ${value.type.name} to ${this.type.name}`);

        const assignment = this.ctx.mod.memory.copy(this.get().ref, value.ref, this.sizeof());
        return {
            expression: binaryen.ExpressionIds.MemoryCopy,
            ref: assignment,
            type: { name: "void", classification: "primitive" }
        };
    }

    access(accessor: string): MiteType {
        const struct_type = this.type;
        if (struct_type.classification !== "struct") throw new Error("unreachable");

        if (!struct_type.fields.has(accessor))
            throw new Error(`Struct ${struct_type.name} does not have field ${accessor}`);
        const field = struct_type.fields.get(accessor)!;

        if (field.type.classification === "primitive") {
            return new Primitive(
                this.ctx,
                field.type,
                AllocationLocation.LinearMemory,
                this._pointer,
                this._offset + field.offset
            );
        } else if (field.type.classification === "struct") {
            return new Struct(this.ctx, field.type, this.pointer, this._offset + field.offset);
        } else {
            throw new Error("unreachable");
        }
    }

    index(index: ExpressionInformation): MiteType {
        throw new Error("Unable to access indices of a struct.");
    }

    sizeof(): number {
        return this.ctx.mod.i32.const(this.type.sizeof);
    }
}

// export class Array implements MiteType {}

// funcref, externref
// export class Reference implements MiteType {}
