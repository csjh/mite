import type { Tree } from "../types.js";
import { tokenize } from "./tokenizer.js";

function parse(input: string): Tree {
    const tokens = tokenize(input);

    for (const token of tokens) {
        console.log(token);
    }

    return;
}
