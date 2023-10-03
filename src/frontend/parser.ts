import {
    TokenType,
    Token,
    BINARY_OPERATORS,
    BinaryOperator,
    ASSIGNMENT_OPERATORS,
    AssignmentOperator
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
    WhileExpression
} from "../types/nodes.js";
import { TYPES } from "../types/code_gen.js";

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
                case TokenType.FN:
                    this.idx++;
                    const node = this.parseFunction();
                    program.body.push(node);
                    break;
                default:
                    break $;
            }
        }

        this.expectToken(TokenType.EOF);

        return program;
    }

    private expectToken(type: TokenType) {
        if (this.token.type !== type) {
            throw new Error(`Expected token of type ${type}, got ${this.token.value}`);
        }
    }

    private expectTypeName(type: string): asserts type is "i32" | "i64" | "f32" | "f64" | "void" {
        if (!["i32", "i64", "f32", "f64", "void"].includes(type)) {
            throw new Error(`Expected type name, got ${type}`);
        }
    }

    private getSignedness(): boolean {
        if (this.token.type === TokenType.SIGNED || this.token.type === TokenType.UNSIGNED) {
            return this.tokens[this.idx++].type === TokenType.UNSIGNED;
        }
        return false;
    }

    /*
    fn identifier(variable: type): type {
        // body
        return 
    }
    */
    private parseFunction(): FunctionDeclaration {
        this.expectToken(TokenType.IDENTIFIER);

        const name = this.tokens[this.idx++].value;

        this.expectToken(TokenType.LEFT_PAREN);
        this.idx++;

        const params: TypedParameter[] = [];
        while (this.token.type !== TokenType.RIGHT_PAREN) {
            const isUnsigned = this.getSignedness();

            const name = this.token.value;
            this.expectToken(TokenType.IDENTIFIER);
            this.idx++;

            this.expectToken(TokenType.COLON);
            this.idx++;

            const type = this.token.value;
            this.expectTypeName(type);
            this.idx++;

            params.push({
                type: "TypedParameter",
                name: {
                    type: "Identifier",
                    name
                },
                typeAnnotation: {
                    type: "Identifier",
                    name: type,
                    isUnsigned
                }
            });

            if (this.token.type === TokenType.COMMA) this.idx++;
        }

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;
        this.expectToken(TokenType.COLON);
        this.idx++;

        this.expectToken(TokenType.IDENTIFIER);
        const isUnsigned = this.getSignedness();
        const return_type = this.token.value;
        this.expectTypeName(return_type);
        this.idx++;

        const body = this.parseBlock();

        return {
            type: "FunctionDeclaration",
            id: {
                type: "Identifier",
                name
            },
            params,
            returnType: {
                type: "Identifier",
                name: return_type,
                isUnsigned
            },
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

        let init,
            prev_idx = this.idx;
        try {
            init = this.parseVariableDeclarationOrAssignment("declaration");
        } catch {
            this.idx = prev_idx;
            init = this.parseExpression();
        }
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
        const expression: SequenceExpression = {
            type: "SequenceExpression",
            expressions: []
        };

        do {
            const node = this.parseExpression();
            expression.expressions.push(node);
        } while (this.token.type === TokenType.COMMA && ++this.idx);

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
        } else if (
            // probably a better way to do this lmao
            this.token.type === TokenType.IDENTIFIER &&
            this.tokens[this.idx + 1].type === TokenType.IDENTIFIER &&
            (this.tokens[this.idx + 2].type === TokenType.ASSIGNMENT ||
                this.tokens[this.idx + 2].type === TokenType.COMMA ||
                this.tokens[this.idx + 2].type === TokenType.SEMICOLON)
        ) {
            statement = this.parseVariableDeclarationOrAssignment("declaration");
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

    private expectAssignmentOperator(token: string): asserts token is AssignmentOperator {
        if (!ASSIGNMENT_OPERATORS.has(token as AssignmentOperator)) {
            throw new Error(
                `Expected assignment operator in (${Array.from(ASSIGNMENT_OPERATORS).join(
                    ", "
                )}), got ${token}`
            );
        }
    }

    private parseVariableDeclarationOrAssignment(type: "declaration"): VariableDeclaration;
    private parseVariableDeclarationOrAssignment(
        type: "assignment",
        left: Identifier
    ): AssignmentExpression;
    private parseVariableDeclarationOrAssignment(
        type: "assignment" | "declaration",
        left?: Identifier
    ): AssignmentExpression | VariableDeclaration {
        if (type === "declaration") {
            const variable: VariableDeclaration = {
                type: "VariableDeclaration",
                declarations: []
            };

            const isUnsigned = this.getSignedness();
            this.expectToken(TokenType.IDENTIFIER);
            const variable_type = this.tokens[this.idx++].value;
            this.expectTypeName(variable_type);
            do {
                const variable_name = this.tokens[this.idx++].value;

                const declaration: VariableDeclarator = {
                    type: "VariableDeclarator",
                    id: {
                        type: "Identifier",
                        name: variable_name
                    },
                    typeAnnotation: {
                        type: "Identifier",
                        name: variable_type,
                        isUnsigned
                    },
                    init: null
                };

                // has initializer
                if (this.token.type === TokenType.ASSIGNMENT) {
                    this.idx++;
                    declaration.init = this.parseExpression();
                }

                variable.declarations.push(declaration);
            } while (this.token.type === TokenType.COMMA && ++this.idx);

            return variable;
        } else if (type === "assignment") {
            const operator = this.token.value;
            this.expectAssignmentOperator(operator);
            this.idx++;

            return {
                type: "AssignmentExpression",
                operator,
                left: left ?? {
                    type: "Identifier",
                    name: this.tokens[this.idx++].value
                },
                right: this.parseExpression()
            } satisfies AssignmentExpression;
        } else {
            throw new Error("Unknown variable operation");
        }
    }

    private parseExpression(): Expression {
        // expressions that start with a keyword (e.g. for, if)
        switch (this.token.type) {
            case TokenType.SEMICOLON:
            case TokenType.RIGHT_PAREN: // these are both for for loops
                return { type: "EmptyExpression" };
            case TokenType.IF:
                return this.parseIfExpression();
            case TokenType.LEFT_BRACE:
                return this.parseBlock();
            case TokenType.LEFT_PAREN:
                this.idx++;
                const expression = this.parseSequenceExpression();
                this.expectToken(TokenType.RIGHT_PAREN);
                this.idx++;
                return expression;
            case TokenType.FOR:
                return this.parseForExpression();
            case TokenType.DO:
                return this.parseDoWhileLoop();
            case TokenType.WHILE:
                return this.parseWhileLoop();
            case TokenType.CONTINUE:
                this.idx++;
                return { type: "ContinueExpression" };
            case TokenType.BREAK:
                this.idx++;
                return { type: "BreakExpression" };
            default:
                break;
        }

        // expressions that start with an identifier or literal (e.g. func(), 1 + 1, x = 5)
        const next = this.getIdentifierOrLiteral();

        switch (this.token.value) {
            case TokenType.SEMICOLON:
            case TokenType.COMMA: // right now commas in function call
            case TokenType.RIGHT_PAREN: // end of a function call
            case TokenType.ELSE: // end of an if statement
                return next;
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
                if (next.type !== "Identifier") throw new Error("Expected identifier, got literal");
                return this.parseVariableDeclarationOrAssignment("assignment", next);
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
                return this.parseBinaryExpression(next);
            case TokenType.LEFT_PAREN:
                if (next.type === "Identifier") return this.parseCallExpression(next);
            default:
                throw new Error(`Unknown expression: ${this.token.value}`);
        }
    }

    private expectBinaryOperator(token: string): asserts token is BinaryOperator {
        if (!BINARY_OPERATORS.has(token as BinaryOperator)) {
            throw new Error(
                `Expected binary operator in (${Array.from(BINARY_OPERATORS).join(
                    ", "
                )}), got ${token}`
            );
        }
    }

    private parseBinaryExpression(left: Identifier | Literal): BinaryExpression {
        const operator = this.token.value;
        this.expectBinaryOperator(operator);
        this.idx++;

        const right = this.parseExpression();

        const binary_expression: BinaryExpression = {
            type: "BinaryExpression",
            operator,
            left,
            right
        };

        return binary_expression;
    }

    private getIdentifierOrLiteral(): Identifier | Literal {
        if (this.token.type === TokenType.IDENTIFIER) return this.getIdentifier();
        else if (this.token.type === TokenType.NUMBER) return this.getLiteral();
        throw new Error(`Expected identifier or literal, got ${this.token.value}`);
    }

    private getIdentifier(): Identifier {
        return {
            type: "Identifier",
            name: this.tokens[this.idx++].value
        };
    }

    private getLiteral(): Literal {
        const raw = this.tokens[this.idx++].value;
        let value: bigint | number;
        // prettier-ignore
        try { value = BigInt(raw); } catch { value = Number(raw); }
        return {
            type: "Literal",
            literalType: raw.includes(".")
                ? TYPES.f64
                : typeof value === "bigint"
                ? TYPES.i64
                : TYPES.i32,
            value
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
            this.idx++;
        }

        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;

        return call_expression;
    }
}
