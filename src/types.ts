export enum TokenType {
    IDENTIFIER,
    NUMBER,

    LEFT_PAREN, // (
    RIGHT_PAREN, // )
    LEFT_BRACE, // {
    RIGHT_BRACE, // }
    SEMICOLON, // ;

    PLUS, // +
    MINUS, // -
    SLASH, // /
    STAR, // *
    ASSIGNMENT, // =

    FN, // fn
    RETURN, // return

    EOF
}

export type Token = {
    type: TokenType;
    value: string;
};

export enum BinaryOperator {
    PLUS,
    MINUS,
    SLASH,
    STAR
}

export type Tree = unknown;
