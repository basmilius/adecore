export { DocumentModel } from './document.ts';
export type { DocumentEditOptions, DocumentLine, OffsetRange, ReplaceAllOptions, ReplaceOptions, TypeTextOptions } from './document.ts';
export { scanBrackets, type BracketIndex, type BracketMatch } from './brackets.ts';
export { findMatches, iterateMatches, findMatchFrom, replacementText, type FindMatch, type FindNextOptions, type FindOptions } from './search.ts';
export { indentationColumn } from './structure.ts';
export { commentSyntax, type CommentSyntax } from './languages.ts';
export { findDocComments, MAX_DOC_COMMENTS, type DocComment } from './doc-comments.ts';
export { DEFAULT_TODO_WORDS, findTodos, type TodoMatch, type TodoOptions } from './todo.ts';
export { detectIndentation, type DetectedIndentation } from './line-order.ts';
export type { TrailingWhitespace, WhitespaceCleanupOptions } from './whitespace-cleanup.ts';
export type { FoldHints, FoldRangeHint, FoldRole, FoldSymbolHint, FoldingOptions, FoldingRange } from './structure.ts';

export type {
    ChangeSource,
    CommandOptions,
    ContentEdit,
    Disposable,
    DocumentChange,
    EditOptions,
    EditorCommand,
    EditorSnapshot,
    Position,
    Selection,
    TextEdit
} from './types.ts';

export { changedSpan, changedSpans, type TextSpan } from './text-span.ts';
export type { TextPlace, TextPlaceKind } from './text-places.ts';
export type { PostfixOperand } from './postfix-operands.ts';
export type { SurroundShape } from './surround-shape.ts';
export type { UnwrapKind, UnwrapTarget } from './unwrap.ts';
