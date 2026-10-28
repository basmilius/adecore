# API reference

Everything comes from the package root, `@adecore/editor-core`.

## DocumentModel

| Group      | Members                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Text       | `getText`, `getLength`, `getLineCount`, `getLine`, `slice`, `positionAt`, `offsetAt`                             |
| Selections | `getSelections`, `getSelectionCount`, `getPrimary`, `setSelections`, `expandSelectionTo`, `occurrencesExhausted` |
| Edits      | `applyEdits`, `setText`, `undo`, `redo`, `getRevision`                                                           |
| State      | `getSnapshot`, `subscribe`                                                                                       |
| Commands   | `typeText`, `paste`, `execute`, `wordSelectionAt`, `wordStartBefore`, `wordEndAfter`                             |
| Search     | `find`, `findNext`, `replace`, `replaceAll`, `replaceMatches`                                                    |
| Folding    | `getFoldingRanges`                                                                                               |
| Saving     | `markSaved`, `getModifiedLines`, `cleanUpWhitespace`; see [Saving](/editor-core/documents#saving)                |
| Comments   | `findTodos`                                                                                                      |
| Lexical    | `placeAt`, `postfixOperands`, `surroundShape`, `unwrapTargets`; see [Lexical queries](#lexical-queries)          |

See [Documents and edits](/editor-core/documents), [Typing and commands](/editor-core/commands) and [Search and folding](/editor-core/search-folding).

## Diffing two texts

`changedSpan(before, after)` returns the one `TextSpan` (`start`, `end`, `text`) that differs between two texts, found from both ends, or `null` when they are equal. `changedSpans(before, after)` runs a line diff and returns one span per changed stretch, in the coordinates of `before`. Past 4 million steps of work, 1,000 changed lines or 16 MiB between the first and last change it gives up and returns the one span.

Apply the spans as one batch to replace a document's text without moving the carets, folds and marks outside the changes:

```ts
const spans = changedSpans(document.getText(), textFromDisk);

document.applyEdits(
    spans.map((span) => ({ from: span.start, to: span.end, text: span.text })),
    { source: 'external' }
);
```

The view's `setText` does exactly this.

## Brackets

`scanBrackets(text, language?)` pairs brackets lexically, so it works on code that does not parse yet. It skips strings and comments of the language (`typescript` by default) and returns a `BracketIndex`: `pairs` maps each opener to its closer and back, and `unmatched` holds the offsets of brackets without a partner. Malformed nesting never yields crossing pairs.

```ts
scanBrackets('call(items[0]').pairs; // Map { 10 => 12, 12 => 10 }
```

`document.matchBracket(offset, language?, limit?)` pairs the one bracket at `offset` as `scanBrackets` would, without lexing the whole document for it. The document keeps the lexer's state at checkpoints a few kilobytes apart, so after an edit it lexes only the stretch the edit is in, and a far mate costs a walk over the checkpoints. It returns a `BracketMatch` whose `mate` is the offset of the partner, or `undefined` for a bracket without one, and `undefined` itself where no bracket of the code stands, such as in a string or a comment. With `limit` it lexes at most about that many characters and returns `null` when that was not enough; the work is kept, so asking again goes on from there. A view that highlights the brackets at the carets passes a limit per frame, so an edit at many carets of a large document never holds up a keystroke.

```ts
const document = new DocumentModel('call(items[0])');
document.matchBracket(4); // { mate: 13 }
document.matchBracket(13); // { mate: 4 }
```

## Lexical queries

Each takes a language id, the one the document is edited as, and reads the same lexer that typing uses.

- `placeAt(offset, language)` returns a `TextPlace`: the `language` the offset is written in and its `kind`, a `TextPlaceKind` of `code`, `comment` or `string`. Embedded regions are resolved: `typescript` or `javascript` in the `<script>` of a Vue file (from its `lang`), `css`, `scss` or `less` in a `<style>`, `html` in a Vue template, in the markup of a PHP file and in JSX children, and `javascript` or `css` in the `<script>` and `<style>` of a markup file. Any other language keeps its own id. Past two million characters the answer is the document's language as code.
- `postfixOperands(dot, language)` lists the expressions that end right before the `.` at `dot`, innermost first, as `PostfixOperand` values: `from` is where the expression starts and `statement` is true on the widest one when it starts a statement. It reads JavaScript, TypeScript and PHP code and returns nothing in a string, a comment, markup or when the dot is a decimal point. A member chain, call chain or literal is one expression, and each prefix operator or binary operator the chain can grow by adds another one, as the syntax tree would: `a * b + c` gives `c` and the whole line, never `b + c`. An assignment, a keyword such as `return` and an opening bracket end the search.
- `surroundShape(from, to, language)` says what a range can be surrounded with, as a `SurroundShape`: the trimmed `from` and `to`, `statements` when the range is whole statements, and `expression` when it is one expression on a line. Both ends must be code inside the same bracket. It returns `null` for a blank range.
- `unwrapTargets(offset, language, indentUnit)` lists what can be unwrapped or removed around an offset in script and PHP code, innermost first, as `UnwrapTarget` values: the `kind` (an `UnwrapKind`: `if`, `else`, `removeElse`, `for`, `while`, `do`, `try`, `removeCatch`, `removeFinally` or `braces`), the `range` of the whole construct and the `edits` that do it. An unwrap keeps the body, moves it to the indentation of the header and drops the header, the closing brace and the clauses that follow (the `else` chain of an `if`, the `catch` and `finally` of a `try`, the `while` of a `do`). A `removeElse`, `removeCatch` or `removeFinally` drops one clause with its body, and a catch only where another catch or a finally stays. `indentUnit` is the indentation removed when a body does not sit deeper than its header. Functions, classes, object literals and `switch` give no targets.

## Search helpers

`findMatches`, `iterateMatches`, `findMatchFrom` and `replacementText` work with an immutable string and revision instead of a model. See [Search and folding](/editor-core/search-folding) for iteration, direction and replacement semantics.

## Other helpers

- `indentationColumn(text, tabSize)` is the width of the leading whitespace of `text`, with tabs expanded.
- `detectIndentation(text)` reads the indentation a text already uses, as a `DetectedIndentation`: `{ insertSpaces: false }` when more lines start with a tab than with spaces, or `{ insertSpaces: true, tabSize }` with the width of one level, the step to a deeper line that occurs most often. The star lines of a block comment are left out, and on a tie the step more indents are a multiple of wins, so a line aligned under a parenthesis does not pass for a level. It returns `null` when no line says, and reads at most the first 10,000 lines. A host that prefers the file's own indentation over its setting passes the result, over its own, as the editor's `indentation` when a file opens.

## Types

| Type                                                                                          | What it is                                                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `Selection`, `TextEdit`, `Position`, `OffsetRange`, `DocumentLine`                            | Offsets, ranges and lines; see [Coordinates](/editor-core/#coordinates) |
| `EditOptions`, `DocumentEditOptions`, `ChangeSource`                                          | Options of `applyEdits`                                                 |
| `EditorSnapshot`, `DocumentChange`, `ContentEdit`, `Disposable`                               | What `subscribe` hands out                                              |
| `EditorCommand`, `CommandOptions`, `TypeTextOptions`                                          | Commands and their options                                              |
| `FindOptions`, `FindNextOptions`, `FindMatch`, `ReplaceOptions`, `ReplaceAllOptions`          | Search                                                                  |
| `FoldingOptions`, `FoldingRange`, `FoldRole`, `FoldHints`, `FoldSymbolHint`, `FoldRangeHint`  | Folding                                                                 |
| `WhitespaceCleanupOptions`, `TrailingWhitespace`                                              | Saving                                                                  |
| `TodoMatch`, `TodoOptions`, `DetectedIndentation`                                             | TODO comments and indentation                                           |
| `TextSpan`, `BracketIndex`, `BracketMatch`                                                    | Helper results and inputs                                               |
| `TextPlace`, `TextPlaceKind`, `PostfixOperand`, `SurroundShape`, `UnwrapTarget`, `UnwrapKind` | Lexical queries                                                         |

Large dense edit batches rebuild the rope in one pass and emit one `contentEdits` stretch covering the changed region. Small or sparse batches retain separate content edits and share unchanged rope branches. In both cases the snapshot keeps the individual offset changes for annotations, maps selections with their existing affinity, and records one undo step.

`replacementText` accepts an optional sixth `maxCharacters` argument, after `preserveCase`. It throws `RangeError` before concatenating expanded output above that limit. Without the argument its existing expansion behavior remains unchanged.

`DocumentEditOptions.selectionPositions` supplies anchor/head positions in the resulting text. They are resolved against the new rope and recorded in the same undo state. Columns are clamped to their line, and a line outside the resulting text throws (the editor engine reports that as `false`). They are ignored when the edits leave the text unchanged. Explicit offset `selections` take precedence when both are supplied. Without either, selections keep their usual mapping.

## TODO comments

`findTodos(text, language, options?)` returns the TODO comments of a text as `TodoMatch`es: `from` and `to` offsets, the zero-based `line` and the `word` of the list it matched. A match starts at one of `options.words` (`DEFAULT_TODO_WORDS`, `TODO` and `FIXME`, without them), found as a whole word in any case wherever it stands in a comment, and ends where the comment does on that line: at the end of a line comment and before the closer of a block comment on the line it closes on. What counts as a comment is the language's, read by the same lexer as the editing commands, so a word in a string or in code is no TODO. A second word in the same comment is part of the first one's match. `document.findTodos(language, options?, first?, last?)` does the same for lines `first` through `last` of a `DocumentModel`, with the lexer state it keeps between edits. `TodoOptions` is the type of `options`.

```ts
findTodos('const x = 1; // TODO: rename', 'typescript'); // [{ from: 16, to: 28, line: 0, word: 'TODO' }]
```

## Documentation comments

`findDocComments(text, languageId, limit?)` returns the documentation comments of a text that have their lines to themselves, as `DocComment`s: `from` and `to` offsets, zero-based inclusive `startLine` and `endLine`, the `indent` in front of the opener and the `body` with the delimiters and margin stars taken off. Only languages that write block comments with a slash and a star have any, a Vue file has them in its script, and past `MAX_DOC_COMMENTS` (500, or `limit`) comments the rest are left out. [`@adecore/editor-react`](/editor-react/rendered-documentation) draws them as formatted text.
