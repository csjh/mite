import { TokenType, type Token } from "../types/tokens.js";

export function tokenize(input: string): Token[] {
    const tokens = [];

    let i = 0;
    while ((i = skipWhitespace(input, i)) < input.length) {
        let token: Token;
        switch (input[i]) {
            case "(":
                token = { type: TokenType.LEFT_PAREN, value: "(" };
                i++;
                break;
            case ")":
                token = { type: TokenType.RIGHT_PAREN, value: ")" };
                i++;
                break;
            case "{":
                token = { type: TokenType.LEFT_BRACE, value: "{" };
                i++;
                break;
            case "}":
                token = { type: TokenType.RIGHT_BRACE, value: "}" };
                i++;
                break;
            case ":":
                token = { type: TokenType.COLON, value: ":" };
                i++;
                break;
            case ",":
                token = { type: TokenType.COMMA, value: "," };
                i++;
                break;
            case ";":
                token = { type: TokenType.SEMICOLON, value: ";" };
                i++;
                break;
            case "+":
                token = { type: TokenType.PLUS, value: "+" };
                i++;
                break;
            case "-":
                token = { type: TokenType.MINUS, value: "-" };
                i++;
                break;
            case "/":
                token = { type: TokenType.SLASH, value: "/" };
                i++;
                break;
            case "*":
                token = { type: TokenType.STAR, value: "*" };
                i++;
                break;
            case "<":
                token = { type: TokenType.LESS_THAN, value: "<" };
                i++;
                break;
            case ">":
                token = { type: TokenType.GREATER_THAN, value: ">" };
                i++;
                break;
            case "=":
                token = { type: TokenType.ASSIGNMENT, value: "=" };
                i++;
                break;
            case "!":
                token = { type: TokenType.NOT, value: "!" };
                i++;
                break;
            case "%":
                token = { type: TokenType.MODULUS, value: "%" };
                i++;
                break;
            case "|":
                token = { type: TokenType.BITWISE_OR, value: "|" };
                i++;
                break;
            case "^":
                token = { type: TokenType.BITWISE_XOR, value: "^" };
                i++;
                break;
            case "&":
                token = { type: TokenType.BITWISE_AND, value: "&" };
                i++;
                break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9": {
                let value = "";
                while (i < input.length && /[0-9]/.test(input[i])) {
                    value += input[i];
                    i++;
                }
                if (i < input.length && input[i] === ".") {
                    value += input[i];
                    i++;
                    while (i < input.length && /[0-9]/.test(input[i])) {
                        value += input[i];
                        i++;
                    }
                }
                token = { type: TokenType.NUMBER, value };
                break;
            }
            default:
                if (!/[a-zA-Z_]/.test(input[i]))
                    throw new Error(`Unexpected character ${input[i]} at index ${i}`);

                let value = "";
                while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
                    value += input[i];
                    i++;
                }
                token = { type: TokenType.IDENTIFIER, value };
        }

        // Check for multi-character tokens
        switch (token.type) {
            case TokenType.IDENTIFIER:
                switch (token.value) {
                    case "fn":
                        token = { type: TokenType.FN, value: "fn" };
                        break;
                    case "return":
                        token = { type: TokenType.RETURN, value: "return" };
                        break;
                    case "if":
                        token = { type: TokenType.IF, value: "if" };
                        break;
                    case "else":
                        token = { type: TokenType.ELSE, value: "else" };
                        break;
                    case "for":
                        token = { type: TokenType.FOR, value: "for" };
                        break;
                    case "do":
                        token = { type: TokenType.DO, value: "do" };
                        break;
                    case "while":
                        token = { type: TokenType.WHILE, value: "while" };
                        break;
                    case "signed":
                        token = { type: TokenType.SIGNED, value: "signed" };
                        break;
                    case "unsigned":
                        token = { type: TokenType.UNSIGNED, value: "unsigned" };
                        break;
                    case "continue":
                        token = { type: TokenType.CONTINUE, value: "continue" };
                        break;
                    case "break":
                        token = { type: TokenType.BREAK, value: "break" };
                        break;
                }
                break;
            case TokenType.PLUS:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_PLUS, value: "+=" };
                    i++;
                }
                break;
            case TokenType.MINUS:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_MINUS, value: "-=" };
                    i++;
                }
                break;
            case TokenType.SLASH:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_SLASH, value: "/=" };
                    i++;
                }
                break;
            case TokenType.STAR:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_STAR, value: "*=" };
                    i++;
                }
                break;
            case TokenType.MODULUS:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_MODULUS, value: "%=" };
                    i++;
                }
                break;
            case TokenType.BITWISE_OR:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_BITWISE_OR, value: "|=" };
                    i++;
                } else if (input[i] === "|") {
                    token = { type: TokenType.LOGICAL_OR, value: "||" };
                    i++;
                }
                break;
            case TokenType.BITWISE_XOR:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_BITWISE_XOR, value: "^=" };
                    i++;
                }
                break;
            case TokenType.BITWISE_AND:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_BITWISE_AND, value: "&=" };
                    i++;
                } else if (input[i] === "&") {
                    token = { type: TokenType.LOGICAL_AND, value: "&&" };
                    i++;
                }
                break;
            case TokenType.ASSIGNMENT:
                if (input[i] === "=") {
                    token = { type: TokenType.EQUALS, value: "==" };
                    i++;
                }
                break;
            case TokenType.LESS_THAN:
                if (input[i] === "=") {
                    token = { type: TokenType.LESS_THAN_EQUALS, value: "<=" };
                    i++;
                } else if (input[i] === "<") {
                    token = { type: TokenType.BITSHIFT_LEFT, value: "<<" };
                    i++;
                }
                break;
            case TokenType.GREATER_THAN:
                if (input[i] === "=") {
                    token = { type: TokenType.GREATER_THAN_EQUALS, value: ">=" };
                    i++;
                } else if (input[i] === ">") {
                    token = { type: TokenType.BITSHIFT_RIGHT, value: ">>" };
                    i++;
                }
                break;
            case TokenType.NOT:
                if (input[i] === "=") {
                    token = { type: TokenType.NOT_EQUALS, value: "!=" };
                    i++;
                } else {
                    throw new Error("not is unsupported");
                }
                break;
        }

        // Check for 3-character tokens
        switch (token.type) {
            case TokenType.BITSHIFT_LEFT:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_BITSHIFT_LEFT, value: "<<=" };
                    i++;
                }
                break;
            case TokenType.BITSHIFT_RIGHT:
                if (input[i] === "=") {
                    token = { type: TokenType.ASSIGNMENT_BITSHIFT_RIGHT, value: ">>=" };
                    i++;
                }
                break;
        }

        tokens.push(token);
    }
    tokens.push({ type: TokenType.EOF, value: "" });

    return tokens;
}

const whitespace = /\s/;
function skipWhitespace(input: string, index: number): number {
    while (index < input.length && whitespace.test(input[index])) {
        index++;
    }
    return index;
}
