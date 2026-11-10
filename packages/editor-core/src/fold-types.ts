/* What a fold is, which the settings choose by to fold it when a file opens. */
export type FoldRole =
    | 'file-header'
    | 'imports'
    | 'doc-comment'
    | 'region'
    | 'function-body'
    | 'method-body'
    | 'class-body'
    | 'object-literal'
    | 'array-literal'
    | 'tag'
    | 'attribute'
    | 'php-tag'
    | 'heredoc'
    | 'front-matter'
    | 'code-fence'
    | 'table';

/*
 * Lines are zero-based and the offsets half-open. Fold from the end of `startLine` through `endLine`.
 * `kind` is the shape: `imports` is a run of import lines, `line-comments` a run of lines of `//` comments,
 * `region` what sits between `// region` and `// endregion`, `block` a run of whole lines such as a code
 * fence, `section` what a Markdown heading holds and `server` a range a language server named.
 */
export interface FoldingRange {
    startLine: number;
    endLine: number;
    from: number;
    to: number;
    kind: 'bracket' | 'comment' | 'indentation' | 'imports' | 'line-comments' | 'region' | 'block' | 'section' | 'server';
    /* What the range is, where the text or a language server says; most ranges have none. */
    role?: FoldRole;
    /* Where a collapsed fold hides from on its first line and shows again from on its last, when a server says; else whole lines. */
    head?: number;
    tail?: number;
}

/* A symbol's range and the kind of body it has. */
export interface FoldSymbolHint {
    from: number;
    to: number;
    /* `value` is a variable or property, which has a function body when its initializer is a function. */
    body: 'function' | 'method' | 'class' | 'value';
}

/* A range a server folds, from any offset on its first line to any offset on its last. */
export interface FoldRangeHint {
    from: number;
    to: number;
    /* The LSP kind: `comment`, `imports` or `region`. */
    kind?: string;
    /* Where it hides from on its first line and shows again from on its last, from the LSP `startCharacter` and `endCharacter`. */
    head?: number;
    tail?: number;
}

export interface FoldHints {
    symbols?: readonly FoldSymbolHint[];
    ranges?: readonly FoldRangeHint[];
}
