interface TypingBracket {
    at: number;
    close: string;
    previous?: TypingBracket;
    /* An `${` whose closer resumes the template text. */
    template?: boolean;
    /* The parenthesis of `if`, `for` and the like. */
    control?: boolean;
    /* A `{` that opens a block, as opposed to an object literal. */
    block?: boolean;
}

/* `html` is the markup of a PHP file around its tags, and `heredoc` the body of a heredoc or nowdoc, which `quote` holds the label of. */
type Mode = 'code' | 'line-comment' | 'block-comment' | 'html-comment' | 'quote' | 'template' | 'regex' | 'html' | 'heredoc';

/* What the lexer knows at one offset. Bracket stacks are immutable, so states share them. */
export interface TypingContext {
    mode: Mode;
    quote?: string;
    escaped: boolean;
    inClass: boolean;
    bracket?: TypingBracket;
    /* Whether an expression may start here, which makes a `/` a regex. */
    expression: boolean;
    /* The last word, or `control-close` after the parenthesis of a control statement. */
    word: string;
    /* Where the comment the lexer is in began, in the document. */
    commentStart?: number;
    /* PHP preserves these fields while code inside an attribute or raw block runs. */
    markup?: 'tag' | 'equals' | 'value' | 'comment' | 'raw';
    markupQuote?: '"' | "'";
    element?: 'script' | 'style' | 'textarea' | 'title';
    embed?: TypingContext;
    embedded?: 'javascript';
    embedStart?: number;
    /* Only a scan result keeps this; PHP consumes the newline immediately after a closing tag. */
    phpClose?: number;
}
