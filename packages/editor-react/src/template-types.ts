/* The families of language a live template belongs to; a family also matches the languages that build on it. */
export type TemplateLanguage = 'javascript' | 'typescript' | 'php' | 'css' | 'html' | 'xml' | 'other';

/* What the text at the caret is: code, a comment or a string. */
export type TemplatePlace = 'code' | 'comment' | 'string';

/* A text that Tab expands after its key, in the syntax of a snippet. */
export interface LiveTemplate {
    /* Stable; a built-in one is `builtin.<language>.<key>`. */
    readonly id: string;

    /* One to 40 characters, none of them whitespace. */
    readonly key: string;

    /* Snippet syntax; the leading tabs of a line are one indentation unit each. */
    readonly body: string;
    readonly description?: string;
    readonly languages: readonly TemplateLanguage[];

    /* Where it applies; `['code']` without it. */
    readonly places?: readonly TemplatePlace[];

    /* What Insert Live Template sorts by; the first language without it. */
    readonly group?: string;
}

/* A text that Tab expands after a dot and its key, around the expression before the dot. */
export interface PostfixTemplate {
    readonly id: string;

    /* Without the dot; identifier characters only. */
    readonly key: string;

    /* Snippet syntax, in which `$EXPR` is the expression. */
    readonly body: string;
    readonly description?: string;

    /* Shown at the end of its row, as in `if (expr) {}`. */
    readonly example?: string;
    readonly languages: readonly ('javascript' | 'typescript' | 'php')[];

    /* `any` without it. */
    readonly expression?: 'any' | 'statement';
}
