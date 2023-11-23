# The Mite Programming Language

Mite is a programming language designed as a high-performance language to accompany Javascript. It compiles to a small, (hopefully) efficient WebAssembly binary using the binaryen toolchain. A major goal of the project is to keep language features to a minimum to prevent binary size bloat.

The compiler is written in Typescript at the moment, with plans to port it to C++ after a solid baseline PoC is established. The language itself is mostly inspired by C, with some other modern features that add minimal overhead which I find useful in other languages.

Mite was made to accompany my learning during my introduction to C university course, and is not intended for production use. Currently, it is not anywhere near feature complete.

## Features

-   All the basic arithmetic, logical, comparison, and bitwise operators
-   Variables
-   Functions
-   If, for, while, do-while expressions
-   Stack-allocated structs
-   First class SIMD support
-   Structs and arrays

## Roadmap

> In no particular order

-   [ ] 0-copy Mite -> Javascript Interop
-   [ ] Javascript Helper Mode
-   [ ] Standard Library
-   [ ] Closures
-   [ ] C++ Port
-   [ ] Heap [^1]
-   [ ] (Graph-based?) IR for optimzations
-   [ ] Strings [^2]

[^1]: A traditional heap (with malloc and free and stuff) is kinda iffy right now, unsure of where it will land atm.
[^2]: This might be pending for the WebAssembly story for strings to be figured out. Right now it seems like one of `stringref` or `JS String Builtins`. String builtins could be polyfilled (albeit possibly slowly), so for now they might be what I go with.
