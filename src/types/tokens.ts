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
    LESS_THAN = "<",
    ASSIGNMENT = "=",

    FN = "fn",
    RETURN = "return",
    IF = "if",
    ELSE = "else",
    FOR = "for",
    DO = "do",
    WHILE = "while",

    SIGNED = "signed",
    UNSIGNED = "unsigned",

    EOF = "EOF"
}
export type BinaryOperator = TokenType.PLUS | TokenType.MINUS | TokenType.SLASH | TokenType.STAR | TokenType.LESS_THAN;

export const BINARY_OPERATORS: Set<BinaryOperator> = new Set([
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.SLASH,
    TokenType.STAR,
    TokenType.LESS_THAN
] as const);

export type Token = {
    type: TokenType;
    value: string;
};
