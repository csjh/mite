export enum TokenType {
    IDENTIFIER,
    NUMBER,
    STRING,

    LEFT_PAREN = "(",
    RIGHT_PAREN = ")",
    LEFT_BRACE = "{",
    RIGHT_BRACE = "}",
    LEFT_BRACKET = "[",
    RIGHT_BRACKET = "]",
    COLON = ":",
    COMMA = ",",
    SEMICOLON = ";",
    PERIOD = ".",

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
    LOGICAL_AND = "&&",
    LOGICAL_OR = "||",

    NOT = "!",

    ASSIGNMENT = "=",
    ASSIGNMENT_PLUS = "+=",
    ASSIGNMENT_MINUS = "-=",
    ASSIGNMENT_SLASH = "/=",
    ASSIGNMENT_STAR = "*=",
    ASSIGNMENT_BITSHIFT_LEFT = "<<=",
    ASSIGNMENT_BITSHIFT_RIGHT = ">>=",
    ASSIGNMENT_MODULUS = "%=",
    ASSIGNMENT_BITWISE_OR = "|=",
    ASSIGNMENT_BITWISE_XOR = "^=",
    ASSIGNMENT_BITWISE_AND = "&=",

    HEAP = "heap",
    STACK = "stack",
    JS = "js",
    LET = "let",
    FN = "fn",
    EXPORT = "export",
    STRUCT = "struct",
    RETURN = "return",
    IF = "if",
    ELSE = "else",
    FOR = "for",
    DO = "do",
    WHILE = "while",
    CONTINUE = "continue",
    BREAK = "break",

    EOF = "EOF"
}

export const BINARY_OPERATORS = new Set([
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
    TokenType.BITWISE_AND,
    TokenType.EQUALS,
    TokenType.NOT_EQUALS
] as const);

export type BinaryOperator = typeof BINARY_OPERATORS extends Set<infer T> ? T : never;

export const ASSIGNMENT_OPERATORS = new Set([
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
] as const);

export type AssignmentOperator = typeof ASSIGNMENT_OPERATORS extends Set<infer T> ? T : never;

export const LOGICAL_OPERATORS = new Set([TokenType.LOGICAL_AND, TokenType.LOGICAL_OR] as const);

export type LogicalOperator = typeof LOGICAL_OPERATORS extends Set<infer T> ? T : never;

export type Token = {
    type: TokenType;
    value: string;
};
