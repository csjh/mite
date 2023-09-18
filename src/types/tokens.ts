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
    EQUALS = "==",
    NOT_EQUALS = "!=",
    LESS_THAN = "<",
    LESS_THAN_EQUALS = "<=",
    GREATER_THAN = ">",
    GREATER_THAN_EQUALS = ">=",
    BITSHIFT_LEFT = "<<",
    BITSHIFT_RIGHT = ">>",
    MODULUS = "%",
    BITWISE_OR = "|",
    BITWISE_XOR = "^",
    BITWISE_AND = "&",

    NOT = "!",

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
export type BinaryOperator =
    | TokenType.PLUS
    | TokenType.MINUS
    | TokenType.SLASH
    | TokenType.STAR
    | TokenType.LESS_THAN
    | TokenType.LESS_THAN_EQUALS
    | TokenType.GREATER_THAN
    | TokenType.GREATER_THAN_EQUALS
    | TokenType.BITSHIFT_LEFT
    | TokenType.BITSHIFT_RIGHT
    | TokenType.MODULUS
    | TokenType.BITWISE_OR
    | TokenType.BITWISE_XOR
    | TokenType.BITWISE_AND;

export const BINARY_OPERATORS: Set<BinaryOperator> = new Set([
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.SLASH,
    TokenType.STAR,
    TokenType.LESS_THAN,
    TokenType.LESS_THAN_EQUALS,
    TokenType.GREATER_THAN,
    TokenType.GREATER_THAN_EQUALS,
    TokenType.BITSHIFT_LEFT,
    TokenType.BITSHIFT_RIGHT,
    TokenType.MODULUS,
    TokenType.BITWISE_OR,
    TokenType.BITWISE_XOR,
    TokenType.BITWISE_AND
] as const);

export type Token = {
    type: TokenType;
    value: string;
};
