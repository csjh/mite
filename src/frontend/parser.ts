import { TokenType, Token, BINARY_OPERATORS, BinaryOperator } from "../types/tokens.js";
import type {
    Program,
    FunctionDeclaration,
    BlockStatement,
    Statement,
    ReturnStatement,
    Identifier,
    BinaryExpression,
    Expression,
    Literal,
    AssignmentExpression,
    VariableDeclaration,
    ExpressionStatement,
    VariableDeclarator
} from "../types/nodes.js";

export class Parser {
    idx: number;

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
            switch (this.tokens[this.idx].type) {
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
        if (this.tokens[this.idx].type !== type) {
            throw new Error(`Expected token of type ${type}, got ${this.tokens[this.idx].value}`);
        }
    }

    private expectTypeName(type: string): asserts type is "i32" | "i64" | "f32" | "f64" {
        if (!["i32", "i64", "f32", "f64"].includes(type)) {
            throw new Error(`Expected type name, got ${type}`);
        }
    }

    private getSignedness(): boolean {
        if (this.tokens[this.idx].type === TokenType.SIGNED || this.tokens[this.idx].type === TokenType.UNSIGNED) {
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
        // todo: parse params
        this.expectToken(TokenType.RIGHT_PAREN);
        this.idx++;
        this.expectToken(TokenType.COLON);
        this.idx++;

        this.expectToken(TokenType.IDENTIFIER);
        const isUnsigned = this.getSignedness();
        const return_type = this.tokens[this.idx].value;
        this.expectTypeName(return_type);
        this.idx++;

        const body = this.parseBlock();

        return {
            type: "FunctionDeclaration",
            id: {
                type: "Identifier",
                name
            },
            params: [],
            returnType: {
                type: "Identifier",
                name: return_type,
                isUnsigned
            },
            body
        };
    }

    private parseBlock(): BlockStatement {
        this.expectToken(TokenType.LEFT_BRACE);
        this.idx++;

        const expression: BlockStatement = {
            type: "BlockStatement",
            body: []
        };

        while (this.tokens[this.idx].type !== TokenType.RIGHT_BRACE) {
            const node = this.parseStatement();
            expression.body.push(node);
        }

        this.expectToken(TokenType.RIGHT_BRACE);
        this.idx++;

        return expression;
    }

    private parseStatement(): Statement {
        let statement: Statement;

        if (this.tokens[this.idx].type === TokenType.RETURN) {
            this.idx++;
            const expression = this.parseExpression();
            statement = {
                type: "ReturnStatement",
                argument: expression
            } satisfies ReturnStatement;
        } else if (
            this.tokens[this.idx].type === TokenType.IDENTIFIER &&
            this.tokens[this.idx + 1].type === TokenType.IDENTIFIER &&
            this.tokens[this.idx + 2].type === TokenType.ASSIGNMENT
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
                if (this.tokens[this.idx].type === TokenType.ASSIGNMENT) {
                    this.idx++;
                    declaration.init = this.parseExpression();
                }

                variable.declarations.push(declaration);
            } while (this.tokens[this.idx].type === TokenType.COMMA && ++this.idx);

            return variable;
        } else if (type === "assignment") {
            this.expectToken(TokenType.ASSIGNMENT);
            this.idx++;

            return {
                type: "AssignmentExpression",
                operator: "=",
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
        // only binary expressions and literals are supported right now
        const next = this.getIdentifierOrLiteral();

        switch (this.tokens[this.idx].value) {
            case TokenType.SEMICOLON:
            case TokenType.COMMA: // todo: commas shouldn't *always* have this effect
                return next;
            case TokenType.ASSIGNMENT:
                if (next.type !== "Identifier") throw new Error("Expected identifier, got literal");
                return this.parseVariableDeclarationOrAssignment("assignment", next);
            case TokenType.PLUS:
            case TokenType.MINUS:
            case TokenType.SLASH:
            case TokenType.STAR:
                return this.parseBinaryExpression(next);
            default:
                throw new Error(`Unknown expression: ${this.tokens[this.idx].value}`);
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
        const operator = this.tokens[this.idx].value;
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
        if (this.tokens[this.idx].type === TokenType.IDENTIFIER) {
            return {
                type: "Identifier",
                name: this.tokens[this.idx++].value
            };
        } else if (this.tokens[this.idx].type === TokenType.NUMBER) {
            const raw = this.tokens[this.idx++].value;
            let value: bigint | number;
            // prettier-ignore
            try { value = BigInt(raw); } catch { value = Number(raw); }
            return {
                type: "Literal",
                value
            };
        } else {
            throw new Error(
                `Expected an identifier or a number, got ${this.tokens[this.idx].value}`
            );
        }
    }
}
