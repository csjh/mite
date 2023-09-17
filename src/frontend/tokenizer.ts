import { TokenType, type Token } from "../types/tokens.js";

export function tokenize(input: string): Token[] {
    const tokens = [];

    let i = 0;
    while ((i = skipWhitespace(input, i)) < input.length) {
        switch (input[i]) {
            case "(":
                tokens.push({ type: TokenType.LEFT_PAREN, value: "(" });
                i++;
                break;
            case ")":
                tokens.push({ type: TokenType.RIGHT_PAREN, value: ")" });
                i++;
                break;
            case "{":
                tokens.push({ type: TokenType.LEFT_BRACE, value: "{" });
                i++;
                break;
            case "}":
                tokens.push({ type: TokenType.RIGHT_BRACE, value: "}" });
                i++;
                break;
            case ":":
                tokens.push({ type: TokenType.COLON, value: ":" });
                i++;
                break;
            case ",":
                tokens.push({ type: TokenType.COMMA, value: "," });
                i++;
                break;
            case ";":
                tokens.push({ type: TokenType.SEMICOLON, value: ";" });
                i++;
                break;
            case "+":
                tokens.push({ type: TokenType.PLUS, value: "+" });
                i++;
                break;
            case "-":
                tokens.push({ type: TokenType.MINUS, value: "-" });
                i++;
                break;
            case "/":
                tokens.push({ type: TokenType.SLASH, value: "/" });
                i++;
                break;
            case "*":
                tokens.push({ type: TokenType.STAR, value: "*" });
                i++;
                break;
            case "<":
                tokens.push({ type: TokenType.LESS_THAN, value: "<" });
                i++;
                break;
            case "=":
                tokens.push({ type: TokenType.ASSIGNMENT, value: "=" });
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
                tokens.push({ type: TokenType.NUMBER, value });
                break;
            }
            default: {
                if (!/[a-zA-Z_]/.test(input[i]))
                    throw new Error(`Unexpected character ${input[i]} at index ${i}`);

                let value = "";
                while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
                    value += input[i];
                    i++;
                }
                switch (value) {
                    case "fn":
                        tokens.push({ type: TokenType.FN, value });
                        break;
                    case "return":
                        tokens.push({ type: TokenType.RETURN, value });
                        break;
                    case "if":
                        tokens.push({ type: TokenType.IF, value });
                        break;
                    case "else":
                        tokens.push({ type: TokenType.ELSE, value });
                        break;
                    case "for":
                        tokens.push({ type: TokenType.FOR, value });
                        break;
                    case "do":
                        tokens.push({ type: TokenType.DO, value });
                        break;
                    case "while":
                        tokens.push({ type: TokenType.WHILE, value });
                        break;
                    case "signed":
                        tokens.push({ type: TokenType.SIGNED, value });
                        break;
                    case "unsigned":
                        tokens.push({ type: TokenType.UNSIGNED, value });
                        break;
                    default:
                        tokens.push({ type: TokenType.IDENTIFIER, value });
                        break;
                }
            }
        }
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
