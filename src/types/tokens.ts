export enum TokenType {
    IDENTIFIER,
    NUMBER,
    STRING,

    LEFT_PAREN = "(",
    RIGHT_PAREN = ")",
    LEFT_BRACE = "{",
    RIGHT_BRACE = "}",
    COLON = ":",
    COMMA = ",",
    SEMICOLON = ";",

    PLUS = "+",
    MINUS = "-",
    SLASH = "/",
    STAR = "*",
    ASSIGNMENT = "=",

    FN = "fn",
    RETURN = "return",

    EOF = "EOF"
}

export const BINARY_OPERATORS = new Set([
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.SLASH,
    TokenType.STAR
] as string[]);

export type Token = {
    type: TokenType;
    value: string;
};
