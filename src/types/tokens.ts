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

    SIGNED = "signed",
    UNSIGNED = "unsigned",

    EOF = "EOF"
}
export type BinaryOperator = TokenType.PLUS | TokenType.MINUS | TokenType.SLASH | TokenType.STAR;

export const BINARY_OPERATORS: Set<BinaryOperator> = new Set([
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.SLASH,
    TokenType.STAR
] as const);

export type Token = {
    type: TokenType;
    value: string;
};
