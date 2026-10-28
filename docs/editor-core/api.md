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
| Comments   | `findTodos`, `commentSyntax`                                                                                     |
| Lexical    | `placeAt`, `postfixOperands`, `surroundShape`, `unwrapTargets`; see [Lexical queries](#lexical-queries)          |

See [Documents and edits](/editor-core/documents), [Typing and commands](/editor-core/commands) and [Search and folding](/editor-core/search-folding).

## Diffing two texts

`changedSpan(before, after)` returns the one `TextSpan` (`start`, `end`, `text`) that differs between two texts, or `null` when they are equal. `changedSpans(before, after)` runs a line diff and returns one span per changed stretch, relative to `before`. A very large diff falls back to the single span.

Apply the spans as one batch to replace a document's text without moving carets, folds and marks outside the changes:

```ts
const spans = changedSpans(document.getText(), textFromDisk);

document.applyEdits(
    spans.map((span) => ({ from: span.start, to: span.end, text: span.text })),
    { source: 'external' }
);
```

The view's `setText` does exactly this.

## Brackets

`scanBrackets(text, language?)` pairs brackets lexically, so it works on code that does not parse yet. It skips strings and comments (`typescript` by default) and returns a `BracketIndex`. `pairs` maps each opener to its closer and back, and `unmatched` holds the offsets of unpaired brackets. Pairs never cross.

```ts
scanBrackets('call(items[0]').pairs; // Map { 10 => 12, 12 => 10 }
```

`document.matchBracket(offset, language?, limit?)` pairs the bracket at `offset` as `scanBrackets` would, lexing only what changed since the last call. It returns a `BracketMatch` whose `mate` is the partner's offset, or `undefined` for an unpaired bracket. It returns `undefined` itself where no code bracket stands, such as in a string. With `limit` it lexes at most about that many characters and returns `null` when that was not enough. Asking again continues where it stopped, so a view can spread the work over frames.

```ts
const document = new DocumentModel('call(items[0])');
document.matchBracket(4); // { mate: 13 }
document.matchBracket(13); // { mate: 4 }
```

## Lexical queries

Each takes the document's language id and uses the same lexer as typing.

- `placeAt(offset, language)` returns a `TextPlace`: the `language` at the offset and its `kind`, a `TextPlaceKind` of `code`, `comment` or `string`. It resolves embedded regions, such as the `<script>` (by its `lang`) and `<style>` of a Vue file, `html` in a Vue template, PHP markup and JSX children. Very large documents report the document's language as code.
- `postfixOperands(dot, language)` lists the expressions ending right before the `.` at `dot`, innermost first, as `PostfixOperand` values. `from` is the expression's start, and `statement` is true on the widest one when it starts a statement. It reads JavaScript, TypeScript and PHP code and returns nothing in a string, comment, markup or after a decimal point. It follows operator precedence: `a * b + c` gives `c` and the whole line, never `b + c`. An assignment, a keyword such as `return` or an opening bracket ends the search.
- `surroundShape(from, to, language)` returns a `SurroundShape`: the trimmed `from` and `to`, `statements` when the range is whole statements, and `expression` when it is one expression on a line. Both ends must be code inside the same bracket. A blank range returns `null`.
- `unwrapTargets(offset, language, indentUnit)` lists what can be unwrapped or removed around an offset in script and PHP code, innermost first, as `UnwrapTarget` values: the `kind` (an `UnwrapKind`: `if`, `else`, `removeElse`, `for`, `while`, `do`, `try`, `removeCatch`, `removeFinally` or `braces`), the construct's `range` and the `edits`. An unwrap keeps the body at the header's indentation and drops the header, closing brace and following clauses. A `remove` kind drops one clause with its body. `indentUnit` is the indentation removed when a body is not deeper than its header. Functions, classes, object literals and `switch` give no targets.

## Search helpers

`findMatches`, `iterateMatches`, `findMatchFrom` and `replacementText` work on a string and revision instead of a model. See [Search and folding](/editor-core/search-folding). `replacementText` takes an optional sixth `maxCharacters` argument and throws `RangeError` when the expanded output would exceed it.

## Other helpers

- `indentationColumn(text, tabSize)` is the width of the leading whitespace of `text`, with tabs expanded.
- `detectIndentation(text)` returns the indentation a text uses as a `DetectedIndentation`: `{ insertSpaces: false }` when tabs dominate, or `{ insertSpaces: true, tabSize }` with the most common level width. It returns `null` when no line tells. A host that prefers the file's indentation passes the result as the editor's `indentation` when a file opens.

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

A large dense edit batch may report one `contentEdits` stretch over the changed region instead of one per edit.

`DocumentEditOptions.selectionPositions` sets anchor and head as line and column positions in the resulting text. Columns clamp to their line, and a line outside the text throws. Offset `selections` win when both are given.

## TODO comments

`findTodos(text, language, options?)` returns the TODO comments of a text as `TodoMatch`es: `from` and `to` offsets, the zero-based `line` and the matched `word`. A match starts at one of `options.words` (default `DEFAULT_TODO_WORDS`: `TODO` and `FIXME`), as a whole word in any case inside a comment, and runs to the comment's end on that line. Words in strings or code do not count. `document.findTodos(language, options?, first?, last?)` does the same for lines `first` through `last` of a `DocumentModel`, reusing its lexer state. `TodoOptions` is the type of `options`.

```ts
findTodos('const x = 1; // TODO: rename', 'typescript'); // [{ from: 16, to: 28, line: 0, word: 'TODO' }]
```

## Documentation comments

`findDocComments(text, languageId, limit?)` returns the `/** */` comments that stand on their own lines, as `DocComment`s: `from` and `to` offsets, zero-based inclusive `startLine` and `endLine`, the opener's `indent` and the `body` without delimiters and margin stars. Comments past `MAX_DOC_COMMENTS` (500, or `limit`) are left out. [`@adecore/editor-react`](/editor-react/rendered-documentation) draws them as formatted text.
