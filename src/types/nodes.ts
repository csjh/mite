// adapter from estree
// shoutout estree

export interface BaseNodeWithoutComments {
    // Every leaf interface that extends BaseNode must specify a type property.
    // The type property should be a string literal. For example, Identifier
    // has: `type: "Identifier"`
    type: string;
    loc?: SourceLocation | null | undefined;
    range?: [number, number] | undefined;
}

export interface BaseNode extends BaseNodeWithoutComments {
    leadingComments?: Comment[] | undefined;
    trailingComments?: Comment[] | undefined;
}

export interface NodeMap {
    AssignmentProperty: AssignmentProperty;
    CatchClause: CatchClause;
    Expression: Expression;
    Function: Function;
    Identifier: Identifier;
    Literal: Literal;
    ModuleDeclaration: ModuleDeclaration;
    ModuleSpecifier: ModuleSpecifier;
    PrivateIdentifier: PrivateIdentifier;
    Program: Program;
    Property: Property;
    PropertyDefinition: PropertyDefinition;
    SpreadElement: SpreadElement;
    Statement: Statement;
    SwitchCase: SwitchCase;
    TemplateElement: TemplateElement;
    VariableDeclarator: VariableDeclarator;
}

export type Node = NodeMap[keyof NodeMap];

export interface Comment extends BaseNodeWithoutComments {
    type: "Line" | "Block";
    value: string;
}

export interface SourceLocation {
    source?: string | null | undefined;
    start: Position;
    end: Position;
}

export interface Position {
    /** >= 1 */
    line: number;
    /** >= 0 */
    column: number;
}

export interface Program extends BaseNode {
    type: "Program";
    body: Array<Directive | Statement | ModuleDeclaration>;
    comments?: Comment[] | undefined;
}

export interface Directive extends BaseNode {
    type: "ExpressionStatement";
    expression: Literal;
    directive: string;
}

export interface TypedParameter extends BaseNode {
    type: "TypedParameter";
    name: Identifier;
    typeAnnotation: TypeIdentifier;
}

export interface BaseFunction extends BaseNode {
    params: TypedParameter[];
    returnType: TypeIdentifier;
    body: BlockExpression;
}

export type Function = FunctionDeclaration | FunctionExpression;

export type Statement =
    | ExpressionStatement // should be expression
    | ReturnStatement // should be expression
    | LabeledStatement // should be expression or nonexistent
    | BreakStatement
    | ContinueStatement
    | IfStatement // should be expression
    | SwitchStatement // should be expression 1000%
    | ThrowStatement
    | TryStatement
    | WhileStatement // should be expressioN?
    | DoWhileStatement // should be expression?
    | ForStatement // should be expression
    | ForInStatement // should be expression
    | ForOfStatement // should be expression
    | Declaration;

export interface BaseStatement extends BaseNode {}

export interface EmptyStatement extends BaseStatement {
    type: "EmptyStatement";
}

export interface BlockExpression extends BaseStatement {
    type: "BlockExpression";
    body: Statement[];
    innerComments?: Comment[] | undefined;
}

export interface ExpressionStatement extends BaseStatement {
    type: "ExpressionStatement";
    expression: Expression;
}

export interface IfStatement extends BaseStatement {
    type: "IfStatement";
    test: Expression;
    consequent: Statement;
    alternate?: Statement | null | undefined;
}

export interface LabeledStatement extends BaseStatement {
    type: "LabeledStatement";
    label: Identifier;
    body: Statement;
}

export interface BreakStatement extends BaseStatement {
    type: "BreakStatement";
    label?: Identifier | null | undefined;
}

export interface ContinueStatement extends BaseStatement {
    type: "ContinueStatement";
    label?: Identifier | null | undefined;
}

export interface WithStatement extends BaseStatement {
    type: "WithStatement";
    object: Expression;
    body: Statement;
}

export interface SwitchStatement extends BaseStatement {
    type: "SwitchStatement";
    discriminant: Expression;
    cases: SwitchCase[];
}

export interface ReturnStatement extends BaseStatement {
    type: "ReturnStatement";
    argument?: Expression | null | undefined;
}

export interface ThrowStatement extends BaseStatement {
    type: "ThrowStatement";
    argument: Expression;
}

export interface TryStatement extends BaseStatement {
    type: "TryStatement";
    block: BlockExpression;
    handler?: CatchClause | null | undefined;
    finalizer?: BlockExpression | null | undefined;
}

export interface WhileStatement extends BaseStatement {
    type: "WhileStatement";
    test: Expression;
    body: Statement;
}

export interface DoWhileStatement extends BaseStatement {
    type: "DoWhileStatement";
    body: Statement;
    test: Expression;
}

export interface ForStatement extends BaseStatement {
    type: "ForStatement";
    init?: VariableDeclaration | Expression | null | undefined;
    test?: Expression | null | undefined;
    update?: Expression | null | undefined;
    body: Statement;
}

export interface BaseForXStatement extends BaseStatement {
    left: VariableDeclaration | Identifier;
    right: Expression;
    body: Statement;
}

export interface ForInStatement extends BaseForXStatement {
    type: "ForInStatement";
}

export interface DebuggerStatement extends BaseStatement {
    type: "DebuggerStatement";
}

export type Declaration = FunctionDeclaration | VariableDeclaration;

export interface BaseDeclaration extends BaseStatement {}

export interface FunctionDeclaration extends BaseFunction, BaseDeclaration {
    type: "FunctionDeclaration";
    id: Identifier;
    body: BlockExpression;
}

export interface VariableDeclaration extends BaseDeclaration {
    type: "VariableDeclaration";
    declarations: VariableDeclarator[];
}

export interface VariableDeclarator extends BaseNode {
    type: "VariableDeclarator";
    id: Identifier;
    typeAnnotation: TypeIdentifier;
    init?: Expression | null | undefined;
}

export interface ExpressionMap {
    ArrayExpression: ArrayExpression;
    AssignmentExpression: AssignmentExpression;
    AwaitExpression: AwaitExpression;
    BinaryExpression: BinaryExpression;
    CallExpression: CallExpression;
    ChainExpression: ChainExpression;
    ConditionalExpression: ConditionalExpression;
    FunctionExpression: FunctionExpression;
    Identifier: Identifier;
    ImportExpression: ImportExpression;
    Literal: Literal;
    LogicalExpression: LogicalExpression;
    MemberExpression: MemberExpression;
    MetaProperty: MetaProperty;
    ObjectExpression: ObjectExpression;
    SequenceExpression: SequenceExpression;
    TaggedTemplateExpression: TaggedTemplateExpression;
    TemplateLiteral: TemplateLiteral;
    ThisExpression: ThisExpression;
    UnaryExpression: UnaryExpression;
    UpdateExpression: UpdateExpression;
    YieldExpression: YieldExpression;
}

export type Expression = ExpressionMap[keyof ExpressionMap];

export interface BaseExpression extends BaseNode {}

export type ChainElement = CallExpression | MemberExpression;

export interface ChainExpression extends BaseExpression {
    type: "ChainExpression";
    expression: ChainElement;
}

export interface ThisExpression extends BaseExpression {
    type: "ThisExpression";
}

export interface ArrayExpression extends BaseExpression {
    type: "ArrayExpression";
    elements: Array<Expression | SpreadElement | null>;
}

export interface ObjectExpression extends BaseExpression {
    type: "ObjectExpression";
    properties: Array<Property | SpreadElement>;
}

export interface PrivateIdentifier extends BaseNode {
    type: "PrivateIdentifier";
    name: string;
}

export interface Property extends BaseNode {
    type: "Property";
    key: Expression | PrivateIdentifier;
    value: Expression | Identifier; // Could be an AssignmentProperty
    kind: "init" | "get" | "set";
    method: boolean;
    shorthand: boolean;
    computed: boolean;
}

export interface PropertyDefinition extends BaseNode {
    type: "PropertyDefinition";
    key: Expression | PrivateIdentifier;
    value?: Expression | null | undefined;
    computed: boolean;
    static: boolean;
}

export interface FunctionExpression extends BaseFunction, BaseExpression {
    id?: Identifier | null | undefined;
    type: "FunctionExpression";
    body: BlockExpression;
}

export interface SequenceExpression extends BaseExpression {
    type: "SequenceExpression";
    expressions: Expression[];
}

export interface UnaryExpression extends BaseExpression {
    type: "UnaryExpression";
    operator: UnaryOperator;
    prefix: true;
    argument: Expression;
}

export interface BinaryExpression extends BaseExpression {
    type: "BinaryExpression";
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
}

export interface AssignmentExpression extends BaseExpression {
    type: "AssignmentExpression";
    operator: AssignmentOperator;
    left: Identifier;
    right: Expression;
}

export interface UpdateExpression extends BaseExpression {
    type: "UpdateExpression";
    operator: UpdateOperator;
    argument: Expression;
    prefix: boolean;
}

export interface LogicalExpression extends BaseExpression {
    type: "LogicalExpression";
    operator: LogicalOperator;
    left: Expression;
    right: Expression;
}

export interface ConditionalExpression extends BaseExpression {
    type: "ConditionalExpression";
    test: Expression;
    alternate: Expression;
    consequent: Expression;
}

export interface CallExpression extends BaseExpression {
    type: "CallExpression";
    callee: Identifier;
    arguments: Array<Expression>;
}

export interface MemberExpression extends BaseExpression, BasePattern {
    type: "MemberExpression";
    object: Expression;
    property: Expression | PrivateIdentifier;
    computed: boolean;
    optional: boolean;
}

export interface BasePattern extends BaseNode {}

export interface SwitchCase extends BaseNode {
    type: "SwitchCase";
    test?: Expression | null | undefined;
    consequent: Statement[];
}

export interface CatchClause extends BaseNode {
    type: "CatchClause";
    param: Identifier | null;
    body: BlockExpression;
}

export interface Identifier extends BaseNode, BaseExpression, BasePattern {
    type: "Identifier";
    name: string;
}

export interface TypeIdentifier extends Identifier {
    name: "i64" | "i32" | "f64" | "f32" | "void";
    isUnsigned: boolean;
}

export interface Literal extends BaseNode, BaseExpression {
    type: "Literal";
    value: number | bigint; // todo: add back string
    raw?: string | undefined;
}

export interface RegExpLiteral extends BaseNode, BaseExpression {
    type: "Literal";
    value?: RegExp | null | undefined;
    regex: {
        pattern: string;
        flags: string;
    };
    raw?: string | undefined;
}

export type UnaryOperator = "-" | "+" | "!" | "~" | "typeof" | "void" | "delete";

export type BinaryOperator =
    | "=="
    | "!="
    | "==="
    | "!=="
    | "<"
    | "<="
    | ">"
    | ">="
    | "<<"
    | ">>"
    | ">>>"
    | "+"
    | "-"
    | "*"
    | "/"
    | "%"
    | "**"
    | "|"
    | "^"
    | "&"
    | "in"
    | "instanceof";

export type LogicalOperator = "||" | "&&" | "??";

export type AssignmentOperator =
    | "="
    | "+="
    | "-="
    | "*="
    | "/="
    | "%="
    | "**="
    | "<<="
    | ">>="
    | ">>>="
    | "|="
    | "^="
    | "&="
    | "||="
    | "&&="
    | "??=";

export type UpdateOperator = "++" | "--";

export interface ForOfStatement extends BaseForXStatement {
    type: "ForOfStatement";
    await: boolean;
}

export interface SpreadElement extends BaseNode {
    type: "SpreadElement";
    argument: Expression;
}

export interface YieldExpression extends BaseExpression {
    type: "YieldExpression";
    argument?: Expression | null | undefined;
    delegate: boolean;
}

export interface TemplateLiteral extends BaseExpression {
    type: "TemplateLiteral";
    quasis: TemplateElement[];
    expressions: Expression[];
}

export interface TaggedTemplateExpression extends BaseExpression {
    type: "TaggedTemplateExpression";
    tag: Expression;
    quasi: TemplateLiteral;
}

export interface TemplateElement extends BaseNode {
    type: "TemplateElement";
    tail: boolean;
    value: {
        /** It is null when the template literal is tagged and the text has an invalid escape (e.g. - tag`\unicode and \u{55}`) */
        cooked?: string | null | undefined;
        raw: string;
    };
}

export interface AssignmentProperty extends Property {
    value: Identifier;
    kind: "init";
    method: boolean; // false
}

export interface ObjectPattern extends BasePattern {
    type: "ObjectPattern";
    properties: Array<AssignmentProperty | RestElement>;
}

export interface ArrayPattern extends BasePattern {
    type: "ArrayPattern";
    elements: Array<Identifier | null>;
}

export interface RestElement extends BasePattern {
    type: "RestElement";
    argument: Identifier;
}

export interface AssignmentPattern extends BasePattern {
    type: "AssignmentPattern";
    left: Identifier;
    right: Expression;
}

export interface MetaProperty extends BaseExpression {
    type: "MetaProperty";
    meta: Identifier;
    property: Identifier;
}

export type ModuleDeclaration =
    | ImportDeclaration
    | ExportNamedDeclaration
    | ExportDefaultDeclaration
    | ExportAllDeclaration;
export interface BaseModuleDeclaration extends BaseNode {}

export type ModuleSpecifier =
    | ImportSpecifier
    | ImportDefaultSpecifier
    | ImportNamespaceSpecifier
    | ExportSpecifier;
export interface BaseModuleSpecifier extends BaseNode {
    local: Identifier;
}

export interface ImportDeclaration extends BaseModuleDeclaration {
    type: "ImportDeclaration";
    specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>;
    source: Literal;
}

export interface ImportSpecifier extends BaseModuleSpecifier {
    type: "ImportSpecifier";
    imported: Identifier;
}

export interface ImportExpression extends BaseExpression {
    type: "ImportExpression";
    source: Expression;
}

export interface ImportDefaultSpecifier extends BaseModuleSpecifier {
    type: "ImportDefaultSpecifier";
}

export interface ImportNamespaceSpecifier extends BaseModuleSpecifier {
    type: "ImportNamespaceSpecifier";
}

export interface ExportNamedDeclaration extends BaseModuleDeclaration {
    type: "ExportNamedDeclaration";
    declaration?: Declaration | null | undefined;
    specifiers: ExportSpecifier[];
    source?: Literal | null | undefined;
}

export interface ExportSpecifier extends BaseModuleSpecifier {
    type: "ExportSpecifier";
    exported: Identifier;
}

export interface ExportDefaultDeclaration extends BaseModuleDeclaration {
    type: "ExportDefaultDeclaration";
    declaration: Declaration | Expression;
}

export interface ExportAllDeclaration extends BaseModuleDeclaration {
    type: "ExportAllDeclaration";
    exported: Identifier | null;
    source: Literal;
}

export interface AwaitExpression extends BaseExpression {
    type: "AwaitExpression";
    argument: Expression;
}
