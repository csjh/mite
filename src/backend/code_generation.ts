import binaryen from "binaryen";
import type { Program } from "../types/nodes.js";

export function program_to_module(program: Program): binaryen.Module {
    const mod = new binaryen.Module();

    return mod;
}
