# Typing and commands

Three methods turn input into edits on every caret at once. Each returns whether anything changed and reads the `language` option to tell code from comments and strings. `typeText` and `paste` default to `typescript`.

## typeText

`typeText(text, options?)` is one keystroke. A single character gets code editor behavior:

- An opening bracket adds its closer unless something after the caret already closes it. A quote pairs only when no identifier character follows.
- Typing a closer the editor added steps over it. That counts as a change, so `typeText` returns `true` with the text unchanged.
- A bracket, quote or `<` typed over a selection wraps it. A quote typed over one quote of a string swaps both.
- A closing bracket typed alone on its line moves back to its opener's indentation.
- In TypeScript, JavaScript and PHP a `;` typed just before the `)` and `]` closing a call goes to the end of the statement.
- In PHP a `-` right after a variable, a member name after `->`, a `)` or a `]` becomes `->`, with the `>` as its own undo step. Typing `>` next steps over it, and Backspace removes both. Any key other than a letter, `_` or `{` turns it back into a minus.
- In PHP markup, attribute quotes pair after `=`. Text, HTML comments, style content and the contents of `title` and `textarea` do not pair. Script content uses JavaScript rules, and PHP islands use PHP rules.

```ts
const document = new DocumentModel('call(x)');

document.setSelections([{ anchor: 6, head: 6 }]);
document.typeText(';', { language: 'typescript' });
document.getText(); // 'call(x);'
```

A `<script>` body inside PHP markup follows JavaScript rules, and PHP-only syntax stays inside PHP islands. Enter in a script string concatenates with `+`, in a PHP string with `.`. A literal `</script>` ends the script, as in HTML. Every non-self-closing script body uses JavaScript rules, whatever its `type`. In very large script bodies, pairing and brace completion stop.

Nothing pairs in plain text (`text`, `plaintext`, `txt` or `log`), in a comment or in a string. Longer text is inserted as is. Consecutive calls join one undo step, the `typing` group.

## paste

`paste(text, options?)` inserts the text with the document's line breaks. With as many lines as carets, each caret gets one line. With `wholeLines: true`, for text copied from a bare caret, the text goes above each bare caret's line. A block pasted into code takes the indentation of its line, unless `indentOnPaste` is `false`.

## execute

`execute(command, options?)` runs an `EditorCommand` on every caret.

| Group                 | Commands                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| History and selection | `undo`, `redo`, `selectAll`, `expandSelection`, `shrinkSelection`                                                                        |
| Words                 | `wordLeft`, `wordRight`, `selectWordLeft`, `selectWordRight`, `deleteWordLeft`, `deleteWordRight` and the same six with `camel`           |
| Line edges            | `smartHome`, `smartEnd`, `selectSmartHome`, `selectSmartEnd`                                                                             |
| Deleting              | `smartBackspace`, `deleteForward`                                                                                                        |
| Lines                 | `duplicateLine`, `deleteLine`, `moveLineUp`, `moveLineDown`, `moveStatementUp`, `moveStatementDown`, `joinLines`, `toggleCase`, `autoIndentLines`, `sortLines`, `reverseLines`, `uniqueLines` |
| Indentation           | `insertTab`, `indent`, `outdent`, `convertIndentsToSpaces`, `convertIndentsToTabs`                                                       |
| Comments              | `toggleLineComment`, `toggleBlockComment`                                                                                                |
| New lines             | `insertNewline`, `startNewLine`, `startNewLineBefore`, `splitLine`, `completeCurrentStatement`                                                                    |
| Completing words      | `hippieCompletion`, `hippieBackwardCompletion`                                                                                           |
| Code blocks           | `codeBlockStart`, `codeBlockEnd`, `codeBlockStartWithSelection`, `codeBlockEndWithSelection`                                             |
| Carets                | `addCaretAbove`, `addCaretBelow`, `addCaretPerSelectedLine`, `selectNextOccurrence`, `unselectOccurrence`, `selectAllOccurrences`        |

Commands that do more than their name says:

- `sortLines`, `reverseLines` and `uniqueLines` act on the lines each selection touches, or on the whole document without a selection. A selection ending at the start of a line leaves that line out. Sorting compares by code unit, so capitals come first, and is stable. `uniqueLines` keeps the first of equal lines.
- `convertIndentsToSpaces` and `convertIndentsToTabs` rewrite only leading whitespace, by `tabSize`.
- `insertNewline` continues a line comment when text follows the caret, closes and continues a `/**` block, splits a string with the language's concatenation, indents after an opener or a `case` label, and closes an unclosed brace. In PHP markup it indents after an opening tag and splits a matching tag pair.
- `smartHome` goes to the first non-blank character, then to the line start.
- `smartBackspace` with only whitespace before the caret, in a bracket-indented language, first goes back to the indentation the brackets give the line, then joins the line above. In comments and strings it goes back one tab stop.
- `insertTab` first steps over a closer the editor added.
- `selectNextOccurrence` from a bare caret selects the word, then the next whole word with the same case. From a selection it finds the text anywhere. With no further match, `occurrencesExhausted` is `true` until the next press starts over.
- `codeBlockStart` and `codeBlockEnd` go to the `{` or `}` of the enclosing block, or across the brace that pairs with one next to the caret. Repeating goes to the outer block. Braces in strings and comments do not count. With `indentGuides: true` a caret on an indent guide goes to that guide's start or end first. The `WithSelection` variants keep the anchor.
- `moveStatementUp` and `moveStatementDown` move whole statements past their neighbor: a multi-line call, a method chain, an `if` with its `else`, a function with its doc comment. In a function body a statement steps into and out of adjacent blocks, re-indented, but never leaves a function or a literal. Declarations and class members swap with the next declaration. In Python and YAML a statement is a line with its indented block. Elsewhere they act like `moveLineUp` and `moveLineDown`. `CommandOptions.structure` passes folding ranges, such as a language server's, to find a statement's extent. `onLinesMoved` reports the moved lines.
- `completeCurrentStatement` closes open brackets and strings, adds the terminator (a semicolon in the C family, PHP, TypeScript and Rust) and turns an `if`, `for`, `else`, function or class header into a block with the caret inside. A `case` label gets its colon, and in Python a block header gets its colon. With nothing to complete it acts like `startNewLine`.
- `hippieCompletion` and `hippieBackwardCompletion` replace the word before each caret with a longer document word with the same start, nearest first, cycling on each press. `CommandOptions.wordSources` adds other documents' texts. `hippieSource` names the word taken from this document.
- `expandSelection` grows through the word, the inside of a string or bracket pair, the pair, the line and the document. `shrinkSelection` walks back. A host with better ranges, such as a language server's, passes them to `expandSelectionTo(ranges)`, one `OffsetRange` or `null` per selection.

The plain word commands stop at camel humps only with `camelCase: true`. The `camel` variants always do. `wordSelectionAt`, `wordStartBefore` and `wordEndAfter` give the same word stops for double click and drag.

## Options

`CommandOptions` reaches all three methods. Every switch is on unless it says otherwise.

| Option                                       | Default        | Meaning                                                               |
| -------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `language`                                   | `'typescript'` | The language id, for comments, strings, brackets and indentation      |
| `tabSize`                                    | `4`            | Clamped to 1 through 16                                               |
| `insertSpaces`                               | `true`         | Indent with spaces                                                    |
| `commentToken`                               |                | Replaces the line comment marker of the language                      |
| `camelCase`                                  | `false`        | Plain word commands stop at camel humps                               |
| `autoClosingPairs`                           | on             | Brackets and quotes together; the next two turn off one kind          |
| `autoClosingBrackets`, `autoClosingQuotes`   | on             |                                                                       |
| `surroundSelection`                          | on             | A bracket or quote typed over a selection wraps it                    |
| `smartSemicolon`                             | on             | Only in TypeScript, JavaScript and PHP                                |
| `smartArrow`                                 | on             | In PHP a `-` after a variable, a member, `)` or `]` becomes `->`      |
| `templateLiterals`                           | on             | In JavaScript and TypeScript, `${` typed in a quoted string makes it a template literal |
| `tabOutOfClosers`                            | on             | Tab steps over a closer the editor added                              |
| `smartEnter`                                 | on             | Enter computes indentation, continues comments and closes braces      |
| `indentOnPaste`                              | on             | A pasted block takes the indentation of its line                      |
| `visualLine(offset)`                         |                | The wrapped row an offset is on, so Home and End go by rows           |
| `lineSpan(line)`                             |                | The lines that stand on one row, such as a collapsed fold             |
| `onLinesMoved(moves)`                        |                | Where each line went after a move, as `{ from, to }` pairs            |

`typeText` also takes `historyGroup` and `expectedRevision`, and `paste` takes `wholeLines`.

A view with folds passes `lineSpan`. A collapsed fold is then one line to delete, duplicate, comment and move, one word stop, and a row that `addCaretAbove` and `addCaretBelow` skip. `onLinesMoved` lets the view move line-bound state, such as a fold, with the text.

## Comments

`toggleLineComment` and `toggleBlockComment` read markers per language: `//` and `/* */` for the C family, PHP and JSON, `#` for Python, shell and YAML, `<!-- -->` for HTML, XML and Markdown, `--` for SQL, Lua and Haskell. In a Vue file the marker follows the block the caret is in. A language with only block comments, such as CSS, wraps each line. An unknown id has no markers, so the toggle does nothing.

JSX child text and element lines use `{/* */}`. Attribute lines and expression bodies keep JavaScript markers. A multiline JSX selection uses its first line's markers throughout, so toggling stays reversible. PHP markup uses HTML comments, `<script>` content JavaScript markers and `<style>` content CSS markers.

The toggles leave alone what they cannot comment safely:

- Lines that start or end inside a multiline tag or attribute, and the contents of `title` and `textarea`.
- In `toggleLineComment`, a line mixing PHP tags and markup, a PHP line containing `?>`, and PHP heredoc, nowdoc and multiline-string lines.
- A PHP or Vue selection that would need different markers.
- In `toggleBlockComment`, a selection that starts or ends inside a PHP literal or crosses a PHP tag or script boundary.
- Multiline HTML comments. A complete one-line comment can still be unwrapped.

HTML comments do not disable embedded PHP. In very large documents, JSX keeps script markers. The scans are lexical and need recognizable JSX elements and static markup tags.
