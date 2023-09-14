export enum TokenType {
    IDENTIFIER,
    NUMBER,
    STRING,

    LEFT_PAREN = "(",
    RIGHT_PAREN = ")",
    LEFT_BRACE = "{",
    RIGHT_BRACE = "}",
    COLON = ":",
    SEMICOLON = ";",

    PLUS = "+",
    MINUS = "-",
    SLASH = "/",
    STAR = "*",
    ASSIGNMENT = "=",

    FN = "fn",
    RETURN = "return",

    EOF = ""
}

export type Token = {
    type: TokenType;
    value: string;
};
