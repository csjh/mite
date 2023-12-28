import {
    TokenType,
    Token,
    BINARY_OPERATORS,
    BinaryOperator,
    ASSIGNMENT_OPERATORS,
    AssignmentOperator,
    LogicalOperator
} from "../types/tokens.js";
import type {
    Program,
    FunctionDeclaration,
    BlockExpression,
    Statement,
    ReturnStatement,
    Identifier,
    BinaryExpression,
    Expression,
    Literal,
    AssignmentExpression,
    VariableDeclaration,
    ExpressionStatement,
    VariableDeclarator,
    CallExpression,
    TypedParameter,
    IfExpression,
    ForExpression,
    SequenceExpression,
    DoWhileExpression,
    WhileExpression,
    LogicalExpression,
    StructDeclaration,
    StructField,
    MemberExpression,
    ExportNamedDeclaration,
    Declaration,
    EmptyExpression,
    ContinueExpression,
    BreakExpression,
    NumberLiteral,
    SIMDLiteral,
    ArrayExpression,
    IndexExpression,
    TypeIdentifier,
    ObjectExpression
} from "../types/nodes.js";
import { AllocationLocation, LinearMemoryLocation } from "../backend/type_classes.js";

const precedence = [
    new Set([TokenType.STAR, TokenType.SLASH, TokenType.MODULUS]),
    new Set([TokenType.PLUS, TokenType.MINUS]),
    new Set([TokenType.BITSHIFT_LEFT, TokenType.BITSHIFT_RIGHT]),
    new Set([
        TokenType.LESS_THAN,
        TokenType.LESS_THAN_EQUALS,
        TokenType.GREATER_THAN,
        TokenType.GREATER_THAN_EQUALS
    ]),
    new Set([TokenType.EQUALS, TokenType.NOT_EQUALS]),
    new Set([TokenType.BITWISE_AND]),
    new Set([TokenType.BITWISE_XOR]),
    new Set([TokenType.BITWISE_OR]),
    new Set([TokenType.LOGICAL_AND]),
    new Set([TokenType.LOGICAL_OR]),
    new Set([
        TokenType.ASSIGNMENT,
        TokenType.ASSIGNMENT_PLUS,
        TokenType.ASSIGNMENT_MINUS,
        TokenType.ASSIGNMENT_SLASH,
        TokenType.ASSIGNMENT_STAR,
        TokenType.ASSIGNMENT_BITSHIFT_LEFT,
        TokenType.ASSIGNMENT_BITSHIFT_RIGHT,
        TokenType.ASSIGNMENT_MODULUS,
        TokenType.ASSIGNMENT_BITWISE_OR,
        TokenType.ASSIGNMENT_BITWISE_XOR,
        TokenType.ASSIGNMENT_BITWISE_AND
    ])
];

export class Parser {
    idx: number;
    get token() {
        return this.tokens[this.idx];
    }

    constructor(readonly tokens: Token[]) {
        this.idx = 0;
    }

    static parse = (input: Token[]) => new Parser(input).parse();

    parse(): Program {
        const program: Program = {
            type: "Program",
            body: []
        };

        // only functions can be top level right now
        $: while (this.idx < this.tokens.length) {
            switch (this.token.type) {
                case TokenType.EXPORT:
                    program.body.push(this.parseExport());
                    break;
                case TokenType.FN:
                    program.body.push(this.parseFunction());
                    break;
                case TokenType.STRUCT:
                    program.body.push(this.parseStruct());
                    break;
                default:
                    break $;
            }
        }

        this.expectToken(TokenType.EOF);

        return program;
    }

    private parseExport(): ExportNamedDeclaration {
        this.expectToken(TokenType.EXPORT);
        this.idx++;

        let declaration: Declaration;
        switch (this.token.type) {
            case TokenType.FN:
                declaration = this.parseFunction();
                break;
            case TokenType.STRUCT:
                declaration = this.parseStruct();
                break;
            default:
                throw new Error(`Unknown export type: ${this.token.value}`);
        }

        return {
            type: "ExportNamedDeclaration",
            declaration
        };
    }

    /*
    struct Coordinate {
        x: i32,
        y: i32
    }
    */
    private parseStruct(): StructDeclaration {
        this.expectToken(TokenType.STRUCT);
        this.idx++;

        this.expectToken(TokenType.IDENTIFIER);
        const name = this.tokens[this.idx++].value;

        this.expectToken(TokenType.LEFT_BRACE);
        this.idx++;

        const fields: StructField[] = [];
        while (this.token.type !== TokenType.RIGHT_BRACE) {
            const name = this.token.value;
            this.expectToken(TokenType.IDENTIFIER);
            this.idx++;

            this.expectToken(TokenType.COLON);
            this.idx++;

            const type = this.token.value;
            this.idx++;

            fields.push({
                type: "StructField",
                name: {
                    type: "Identifier",
                    name
                },
                typeAnnotation: {
                    type: "Identifier",
                    name: type
                }
            });

            if (this.token.type === TokenType.COMMA) this.idx++;
        }

        this.expectToken(TokenType.RIGHT_BRACE);
        this.idx++;

        return {
            type: "StructDeclaration",
            id: {
                type: "Identifier",
                name
            },
            fields
        };
    }

    private expectToken(type: TokenType) {
        if (this.token.type !== type) {
            throw new Error(`Expected token of type ${type}, got ${this.token.value}`);
        }
    }

    /*
    fn identifier(variable: type): type {
        // body
        return 
    }
    */
    private parseFunction(): FunctionDeclaration {
        this.expectToken(TokenType.FN);
        this.idx++;

        this.expectToken(TokenType.IDENTIFIER);
        const name = this.tokens[this.idx++].value;

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        const params: TypedParameter[] = [];
        while (this.token.type !== TokenType.RIGHT_PAREN) {
            const name = this.getIdentifier();

            this.expectToken(TokenType.COLON);
            this.idx++;

            const typeAnnotation = this.parseType();

            params.push({ type: "TypedParameter", name, typeAnnotation });

            if (this.token.type === TokenType.COMMA) this.idx++;
        }

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;
        this.expectToken(TokenType.COLON);
        this.idx++;

        const returnType = this.parseType();

        const body = this.parseBlock();

        return {
            type: "FunctionDeclaration",
            id: {
                type: "Identifier",
                name
            },
            params,
            returnType,
            body
        };
    }

    private parseIfExpression(): IfExpression {
        this.expectToken(TokenType.IF);
        this.idx++;

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;
        const test = this.parseExpression();
        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        const consequent = this.parseExpression();

        let alternate: Expression | null = null;
        if (this.token.type === TokenType.ELSE) {
            this.idx++;
            alternate = this.parseExpression();
        }

        return {
            type: "IfExpression",
            test,
            consequent,
            alternate
        };
    }

    private parseForExpression(): ForExpression {
        this.expectToken(TokenType.FOR);
        this.idx++;

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        const init =
            this.token.type === TokenType.LET
                ? this.parseVariableDeclaration()
                : this.parseExpression();
        this.expectToken(TokenType.SEMICOLON);
        this.idx++;

        const test = this.parseExpression();
        this.expectToken(TokenType.SEMICOLON);
        this.idx++;

        const update = this.parseExpression();
        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        const body = this.parseExpression();

        return {
            type: "ForExpression",
            init,
            test,
            update,
            body
        };
    }

    private parseDoWhileLoop(): DoWhileExpression {
        this.expectToken(TokenType.DO);
        this.idx++;

        const body = this.parseExpression();

        this.expectToken(TokenType.WHILE);
        this.idx++;

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        const test = this.parseExpression();

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        return {
            type: "DoWhileExpression",
            body,
            test
        };
    }

    private parseWhileLoop(): WhileExpression {
        this.expectToken(TokenType.WHILE);
        this.idx++;

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        const test = this.parseExpression();

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        const body = this.parseExpression();

        return {
            type: "WhileExpression",
            test,
            body
        };
    }

    private parseSequenceExpression(): SequenceExpression {
        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        const expression: SequenceExpression = {
            type: "SequenceExpression",
            expressions: []
        };

        do {
            const node = this.parseExpression();
            expression.expressions.push(node);
        } while (this.token.type === TokenType.COMMA && ++this.idx);

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        return expression;
    }

    private parseBlock(): BlockExpression {
        this.expectToken(TokenType.LEFT_BRACE);
        this.idx++;

        const expression: BlockExpression = {
            type: "BlockExpression",
            body: []
        };

        while (this.token.type !== TokenType.RIGHT_BRACE) {
            const node = this.parseStatement();
            expression.body.push(node);
        }

        this.expectToken(TokenType.RIGHT_BRACE);
        this.idx++;

        return expression;
    }

    private parseStatement(): Statement {
        let statement: Statement;

        if (this.token.type === TokenType.RETURN) {
            this.idx++;
            const expression = this.parseExpression();
            statement = {
                type: "ReturnStatement",
                argument: expression
            } satisfies ReturnStatement;
        } else if (this.token.type === TokenType.LET) {
            statement = this.parseVariableDeclaration();
        } else {
            statement = {
                type: "ExpressionStatement",
                expression: this.parseExpression()
            } satisfies ExpressionStatement;
        }

        // statements end with a semicolon
        this.expectToken(TokenType.SEMICOLON);
        this.idx++;

        return statement;
    }

    private parseVariableDeclaration(): VariableDeclaration {
        const variable: VariableDeclaration = {
            type: "VariableDeclaration",
            declarations: []
        };

        this.expectToken(TokenType.LET);
        this.idx++;
        do {
            const declaration: Partial<VariableDeclarator> = {
                type: "VariableDeclarator",
                id: this.getIdentifier()
            };

            if (this.token.type === TokenType.COLON) {
                this.idx++;
                const type = this.parseType();

                declaration.typeAnnotation = type;
            }

            // has initializer
            if (this.token.type === TokenType.ASSIGNMENT) {
                this.idx++;
                declaration.init = this.parseExpression();
            }

            if (!(declaration.init || declaration.typeAnnotation)) {
                throw new Error("Variable declaration must have initializer or type annotation");
            }

            variable.declarations.push(declaration as VariableDeclarator);
        } while (this.token.type === TokenType.COMMA && ++this.idx);

        return variable;
    }

    private isExpression(
        operator_or_expression: unknown
    ): asserts operator_or_expression is Expression {
        if (
            !(
                typeof operator_or_expression === "object" &&
                operator_or_expression !== null &&
                "type" in operator_or_expression
            )
        ) {
            throw new Error("Expected expression");
        }
    }

    private parseExpression(): Expression {
        let expression_stack: (
            | Expression
            | BinaryOperator
            | AssignmentOperator
            | LogicalOperator
        )[] = [];

        expressions: while (true) {
            switch (this.token.type) {
                case TokenType.SEMICOLON:
                case TokenType.RIGHT_PAREN: // these are both for for loops
                    expression_stack.push(this.parseEmptyExpression());
                    break;
                case TokenType.LEFT_BRACKET:
                    expression_stack.push(this.parseArrayExpression());
                    break;
                case TokenType.IF:
                    expression_stack.push(this.parseIfExpression());
                    break;
                case TokenType.LEFT_BRACE:
                    if (this.tokens[this.idx + 1].type === TokenType.NUMBER) {
                        expression_stack.push(this.getSIMDLiteral());
                    } else {
                        expression_stack.push(this.parseBlock());
                    }
                    break;
                case TokenType.LEFT_PAREN:
                    expression_stack.push(this.parseSequenceExpression());
                    break;
                case TokenType.FOR:
                    expression_stack.push(this.parseForExpression());
                    break;
                case TokenType.DO:
                    expression_stack.push(this.parseDoWhileLoop());
                    break;
                case TokenType.WHILE:
                    expression_stack.push(this.parseWhileLoop());
                    break;
                case TokenType.CONTINUE:
                    expression_stack.push(this.parseContinueExpression());
                    break;
                case TokenType.BREAK:
                    expression_stack.push(this.parseBreakExpression());
                    break;
                case TokenType.NUMBER:
                    expression_stack.push(this.getNumberLiteral());
                    break;
                case TokenType.IDENTIFIER:
                    const next = this.getIdentifier();
                    // @ts-expect-error
                    if (this.token.type === TokenType.LEFT_PAREN) {
                        expression_stack.push(this.parseCallExpression(next));
                        // @ts-expect-error
                    } else if (this.token.type === TokenType.LEFT_BRACE) {
                        expression_stack.push(this.parseStructLiteral(next));
                    } else {
                        expression_stack.push(next);
                    }
                    break;
                case TokenType.ARENA:
                // case TokenType.STACK:
                case TokenType.JS:
                    if (this.tokens[this.idx + 1].type === TokenType.LEFT_BRACKET) {
                        expression_stack.push(
                            this.parseArrayExpression(
                                this.tokens[this.idx++].value as LinearMemoryLocation
                            )
                        );
                    } else {
                        const type = this.parseType();
                        expression_stack.push(this.parseStructLiteral(type));
                    }
                default:
                    break;
            }

            while (
                this.token.type === TokenType.LEFT_BRACKET ||
                this.token.type === TokenType.PERIOD
            ) {
                const last = expression_stack.pop()!;
                if (typeof last === "string") throw new Error("Expected expression");
                if (this.token.type === TokenType.LEFT_BRACKET) {
                    expression_stack.push(this.parseIndexExpression(last));
                } else if (this.token.type === TokenType.PERIOD) {
                    expression_stack.push(this.parseMemberExpression(last));
                }
            }

            switch (this.token.type) {
                case TokenType.SEMICOLON:
                case TokenType.RIGHT_PAREN: // end of a function call
                case TokenType.RIGHT_BRACKET: // end of an array literal
                case TokenType.RIGHT_BRACE: // end of a struct literal
                case TokenType.COMMA: // right now commas in function call
                case TokenType.ELSE: // end of an if statement
                case TokenType.WHILE: // end of a do/while loop body
                    break expressions;
                case TokenType.ASSIGNMENT:
                case TokenType.ASSIGNMENT_BITSHIFT_LEFT:
                case TokenType.ASSIGNMENT_BITSHIFT_RIGHT:
                case TokenType.ASSIGNMENT_BITWISE_AND:
                case TokenType.ASSIGNMENT_BITWISE_OR:
                case TokenType.ASSIGNMENT_BITWISE_XOR:
                case TokenType.ASSIGNMENT_MINUS:
                case TokenType.ASSIGNMENT_MODULUS:
                case TokenType.ASSIGNMENT_PLUS:
                case TokenType.ASSIGNMENT_SLASH:
                case TokenType.ASSIGNMENT_STAR:
                case TokenType.PLUS:
                case TokenType.MINUS:
                case TokenType.SLASH:
                case TokenType.STAR:
                case TokenType.EQUALS:
                case TokenType.NOT_EQUALS:
                case TokenType.LESS_THAN:
                case TokenType.LESS_THAN_EQUALS:
                case TokenType.GREATER_THAN:
                case TokenType.GREATER_THAN_EQUALS:
                case TokenType.BITSHIFT_LEFT:
                case TokenType.BITSHIFT_RIGHT:
                case TokenType.MODULUS:
                case TokenType.BITWISE_OR:
                case TokenType.BITWISE_XOR:
                case TokenType.BITWISE_AND:
                case TokenType.LOGICAL_AND:
                case TokenType.LOGICAL_OR:
                    expression_stack.push(this.token.type);
                    this.idx++;
                    break;
                default:
                    throw new Error(`Expected operator, got: ${this.token.value}`);
            }
        }

        for (const operators of precedence) {
            // assignment operators are right to left
            const RIGHT_TO_LEFT = operators === precedence[precedence.length - 1];

            const new_stack: typeof expression_stack = [];
            if (!RIGHT_TO_LEFT) {
                for (let i = 0; i < expression_stack.length; i += 2) {
                    const left = expression_stack[i];
                    this.isExpression(left);
                    const operator = expression_stack[i + 1];
                    // we're at the last element of the array
                    if (typeof operator === "undefined") {
                        new_stack.push(left);
                        break;
                    }
                    if (typeof operator !== "string") throw new Error("Expected operator");

                    if (operators.has(operator)) {
                        const right = expression_stack[i + 2];
                        this.isExpression(right);

                        expression_stack[i + 2] = this.constructBinaryExpression(
                            left,
                            operator,
                            right
                        );
                    } else {
                        new_stack.push(left);
                        new_stack.push(operator);
                    }
                }
            } else {
                for (let i = expression_stack.length - 1; i >= 0; i -= 2) {
                    const right = expression_stack[i];
                    this.isExpression(right);
                    const operator = expression_stack[i - 1];
                    // we're at the last element of the array
                    if (typeof operator === "undefined") {
                        new_stack.push(right);
                        break;
                    }
                    if (typeof operator !== "string") throw new Error("Expected operator");

                    if (operators.has(operator)) {
                        const left = expression_stack[i - 2];
                        this.isExpression(left);

                        expression_stack[i - 2] = this.constructBinaryExpression(
                            left,
                            operator,
                            right
                        );
                    } else {
                        new_stack.push(right);
                        new_stack.push(operator);
                    }
                }
            }

            expression_stack = new_stack;
            if (expression_stack.length === 1) {
                return expression_stack[0] as Expression;
            }
        }

        throw new Error(`Something is weird in this array: ${expression_stack.join(" | ")}`);
    }

    private constructBinaryExpression(
        left: Expression,
        operator: BinaryOperator | AssignmentOperator | LogicalOperator,
        right: Expression
    ): Expression {
        switch (operator) {
            case TokenType.ASSIGNMENT:
            case TokenType.ASSIGNMENT_BITSHIFT_LEFT:
            case TokenType.ASSIGNMENT_BITSHIFT_RIGHT:
            case TokenType.ASSIGNMENT_BITWISE_AND:
            case TokenType.ASSIGNMENT_BITWISE_OR:
            case TokenType.ASSIGNMENT_BITWISE_XOR:
            case TokenType.ASSIGNMENT_MINUS:
            case TokenType.ASSIGNMENT_MODULUS:
            case TokenType.ASSIGNMENT_PLUS:
            case TokenType.ASSIGNMENT_SLASH:
            case TokenType.ASSIGNMENT_STAR:
                if (
                    left.type !== "Identifier" &&
                    left.type !== "MemberExpression" &&
                    left.type !== "IndexExpression"
                ) {
                    throw new Error("Expected identifier, got literal");
                }
                return {
                    type: "AssignmentExpression",
                    operator,
                    left,
                    right
                } satisfies AssignmentExpression;
            case TokenType.PLUS:
            case TokenType.MINUS:
            case TokenType.SLASH:
            case TokenType.STAR:
            case TokenType.EQUALS:
            case TokenType.NOT_EQUALS:
            case TokenType.LESS_THAN:
            case TokenType.LESS_THAN_EQUALS:
            case TokenType.GREATER_THAN:
            case TokenType.GREATER_THAN_EQUALS:
            case TokenType.BITSHIFT_LEFT:
            case TokenType.BITSHIFT_RIGHT:
            case TokenType.MODULUS:
            case TokenType.BITWISE_OR:
            case TokenType.BITWISE_XOR:
            case TokenType.BITWISE_AND:
                return {
                    type: "BinaryExpression",
                    operator,
                    left,
                    right
                } satisfies BinaryExpression;
            case TokenType.LOGICAL_AND:
            case TokenType.LOGICAL_OR:
                return {
                    type: "LogicalExpression",
                    operator,
                    left,
                    right
                } satisfies LogicalExpression;
            default:
                throw new Error(`Unknown operator: ${operator}`);
        }
    }

    private getIdentifier(): Identifier {
        const token = this.tokens[this.idx++];
        if (token.type !== TokenType.IDENTIFIER) {
            throw new Error(`Expected identifier, got ${token.type}`);
        }
        return {
            type: "Identifier",
            name: token.value
        };
    }

    private getNumberLiteral(): NumberLiteral {
        const raw = this.tokens[this.idx++].value;
        let value: bigint | number;
        // prettier-ignore
        try { value = BigInt(raw); } catch { value = Number(raw); }

        if (typeof value === "number") {
            return {
                type: "Literal",
                literalType: "f64",
                value
            };
        }

        let signed = value < 0n;
        if (signed) {
            if (value > -(2n ** 31n)) {
                return {
                    type: "Literal",
                    literalType: "i32",
                    value
                };
            } else if (value > -(2n ** 63n)) {
                return {
                    type: "Literal",
                    literalType: "i64",
                    value
                };
            } else {
                throw new Error("Number literal out of range");
            }
        } else {
            if (value < 2n ** 31n - 1n) {
                return {
                    type: "Literal",
                    literalType: "i32",
                    value
                };
            } else if (value < 2n ** 32n - 1n) {
                return {
                    type: "Literal",
                    literalType: "u32",
                    value
                };
            } else if (value < 2n ** 63n - 1n) {
                return {
                    type: "Literal",
                    literalType: "i64",
                    value
                };
            } else if (value < 2n ** 64n - 1n) {
                return {
                    type: "Literal",
                    literalType: "u64",
                    value
                };
            } else {
                throw new Error("Number literal out of range");
            }
        }
    }

    // i32x4 n = { 1, 2, 3, 4 };
    private getSIMDLiteral(): SIMDLiteral {
        this.expectToken(TokenType.LEFT_BRACE);
        this.idx++;

        const values: (number | bigint)[] = [];
        while (this.token.type !== TokenType.RIGHT_BRACE) {
            values.push(this.getNumberLiteral().value);
            if (this.token.type === TokenType.COMMA) this.idx++;
        }

        const has_floats = values.some((x) => typeof x === "number");

        let literalType: SIMDLiteral["literalType"];
        let bytes: TypedArray;
        if (values.length === 2) {
            if (has_floats) {
                bytes = Float64Array.from(values.map(Number));
                literalType = "f64x2";
            } else {
                const signed = values.some((v) => v < 0n);
                const unsigned = values.some((v) => v > 0x7fffffffffffffffn);
                if (signed && unsigned) {
                    throw new Error("SIMD literal value out of range");
                }
                bytes = (signed ? BigInt64Array : BigUint64Array).from(values.map(BigInt));
                literalType = signed ? "i64x2" : "u64x2";
            }
        } else if (values.length === 4) {
            if (has_floats) {
                bytes = Float32Array.from(values.map(Number));
                literalType = "f32x4";
            } else {
                const signed = values.some((v) => v < 0n);
                const unsigned = values.some((v) => v > 0x7fffffffn);
                if (signed && unsigned) {
                    throw new Error("SIMD literal value out of range");
                }
                bytes = (signed ? Int32Array : Uint32Array).from(values.map(Number));
                literalType = signed ? "i32x4" : "u32x4";
            }
        } else if (values.length === 8) {
            if (has_floats) throw new Error("i16x8 SIMD literal must be integers");
            const signed = values.some((v) => v < 0n);
            const unsigned = values.some((v) => v > 0x7fffn);
            if (signed && unsigned) {
                throw new Error("SIMD literal value out of range");
            }
            bytes = (signed ? Int16Array : Uint16Array).from(values.map(Number));
            literalType = signed ? "i16x8" : "u16x8";
        } else if (values.length === 16) {
            if (has_floats) throw new Error("i8x16 SIMD literal must be integers");
            const signed = values.some((v) => v < 0n);
            const unsigned = values.some((v) => v > 0x7fn);
            if (signed && unsigned) {
                throw new Error("SIMD literal value out of range");
            }
            bytes = (signed ? Int8Array : Uint8Array).from(values.map(Number));
            literalType = signed ? "i16x8" : "u16x8";
        } else {
            throw new Error(
                `Invalid number of values in SIMD literal: ${values.length}. Values: ${values.join(
                    ", "
                )}}`
            );
        }

        this.expectToken(TokenType.RIGHT_BRACE);
        this.idx++;

        return {
            type: "Literal",
            literalType,
            value: Array.from(new Uint8Array(bytes.buffer))
        };
    }

    private parseCallExpression(func_name: Identifier): CallExpression {
        const call_expression: CallExpression = {
            type: "CallExpression",
            callee: func_name,
            arguments: []
        };

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        while (true) {
            const argument = this.parseExpression();
            call_expression.arguments.push(argument);

            if (this.token.type === TokenType.RIGHT_PAREN) break;
            this.expectToken(TokenType.COMMA);
            this.idx++;
        }

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        return call_expression;
    }

    private parseMemberExpression(object: MemberExpression["object"]): MemberExpression {
        do {
            this.expectToken(TokenType.PERIOD);
            this.idx++;

            const property = this.getIdentifier();

            object = {
                type: "MemberExpression",
                object,
                property
            };
        } while (this.token.type === TokenType.PERIOD);

        return object;
    }

    private parseIndexExpression(object: IndexExpression["object"]): IndexExpression {
        do {
            this.expectToken(TokenType.LEFT_BRACKET);
            this.idx++;

            const index = this.parseExpression();

            object = {
                type: "IndexExpression",
                object,
                index
            };

            this.expectToken(TokenType.RIGHT_BRACKET);
            this.idx++;
        } while (this.token.type === TokenType.LEFT_BRACKET);

        return object;
    }

    private parseEmptyExpression(): EmptyExpression {
        return { type: "EmptyExpression" };
    }

    private parseContinueExpression(): ContinueExpression {
        this.expectToken(TokenType.CONTINUE);
        this.idx++;
        return { type: "ContinueExpression" };
    }

    private parseBreakExpression(): BreakExpression {
        this.expectToken(TokenType.BREAK);
        this.idx++;
        return { type: "BreakExpression" };
    }

    private parseArrayExpression(location?: LinearMemoryLocation): ArrayExpression {
        this.expectToken(TokenType.LEFT_BRACKET);
        this.idx++;

        const elements: Expression[] = [];
        while (this.token.type !== TokenType.RIGHT_BRACKET) {
            elements.push(this.parseExpression());
            if (this.token.type === TokenType.COMMA) this.idx++;
        }

        this.expectToken(TokenType.RIGHT_BRACKET);
        this.idx++;

        return {
            type: "ArrayExpression",
            elements,
            location
        };
    }

    private parseType(): TypeIdentifier {
        const is_ref = this.tokens[this.idx].type === TokenType.REF;
        if (is_ref) this.idx++;

        let location: LinearMemoryLocation | undefined = undefined;
        if (this.token.type === TokenType.ARENA) {
            location = AllocationLocation.Arena;
            this.idx++;
            // } else if (this.token.type === TokenType.STACK) {
            //     location = AllocationLocation.Stack;
            //     this.idx++;
        } else if (this.token.type === TokenType.JS) {
            location = AllocationLocation.JS;
            this.idx++;
        }

        const token = this.tokens[this.idx++];
        if (token.type === TokenType.IDENTIFIER)
            return { type: "Identifier", name: token.value, location };
        if (token.type !== TokenType.LEFT_BRACKET)
            throw new Error(`Expected type, got ${token.type}`);

        const type = this.parseType();
        this.expectToken(TokenType.SEMICOLON);
        this.idx++;

        const length = this.getNumberLiteral();
        this.expectToken(TokenType.RIGHT_BRACKET);
        this.idx++;

        return { type: "Identifier", name: `[${type.name}; ${length.value}]`, location, isRef: is_ref };
    }

    private parseStructLiteral(typeAnnotation: TypeIdentifier): ObjectExpression {
        const object: ObjectExpression = {
            type: "ObjectExpression",
            typeAnnotation,
            properties: []
        };

        this.expectToken(TokenType.LEFT_BRACE);
        this.idx++;

        while (this.token.type !== TokenType.RIGHT_BRACE) {
            const key = this.getIdentifier();

            object.properties.push({
                type: "Property",
                key,
                shorthand: this.token.type === TokenType.COMMA,
                value:
                    this.token.type === TokenType.COLON
                        ? (this.idx++, this.parseExpression())
                        : key,
                method: false
            });

            if (this.token.type === TokenType.COMMA) this.idx++;
        }

        this.expectToken(TokenType.RIGHT_BRACE);
        this.idx++;

        return object;
    }
}
