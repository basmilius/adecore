# Commands, search, and structure

`typeText(text, options?)` models one typing operation at every caret. `paste(text, options?)` handles a pasted block. `execute(command, options?)` runs an `EditorCommand` and reports whether it changed text or selection. Typing over an inserted closer can return `true` while only moving the caret.

## Editing behavior

| Command group                     | Examples                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| History and selection             | `undo`, `redo`, `selectAll`, `expandSelection`, `shrinkSelection`                                                                 |
| Word movement and deletion        | `wordLeft`, `selectWordRight`, `deleteWordLeft`, explicit `camel*` variants                                                       |
| Line edges and character deletion | `smartHome`, `smartEnd`, selecting variants, `smartBackspace`, `deleteForward`                                                    |
| Lines                             | `duplicateLine`, `deleteLine`, `moveLineUp`, `moveLineDown`, `joinLines`, `toggleCase`, `autoIndentLines`                         |
| Indentation and comments          | `insertTab`, `indent`, `outdent`, `toggleLineComment`, `toggleBlockComment`                                                       |
| New lines                         | `insertNewline`, `startNewLine`, `startNewLineBefore`, `splitLine`                                                                |
| Multiple carets                   | `addCaretAbove`, `addCaretBelow`, `addCaretPerSelectedLine`, `selectNextOccurrence`, `unselectOccurrence`, `selectAllOccurrences` |

`CommandOptions` defaults to tab width 4 with spaces. Tab width clamps to 1 through 16. Ordinary word commands stop at camel humps only with `camelCase: true`; explicit camel commands always do. Language ids select comment markers and lexical typing behavior. `commentToken` overrides the line marker.

Bracket and quote pairing, selection wrapping, stepping over inserted closers with Tab, smart Enter, indentation on paste, and smart semicolons are controlled separately. The DOM view translates its [`EditorSmartKeys`](/editor/handbook/configuration) into these options. Plain text does not gain code pairing merely because pairing is enabled. Smart semicolons cross trailing `)` and `]` only in TypeScript, JavaScript, and PHP.

Enter uses lexical context to continue comments, indent new lines, and close unmatched braces. Comment toggling uses language-specific markers. Paste preserves the document's line-break style, distributes lines across carets when their counts match, and can paste whole-line clipboard text above bare carets with `wholeLines: true`. These are lexical rules, not a formatter or parser.

`visualLine(offset)` lets smart Home/End follow wrapped rows. `lineSpan(line)` makes a collapsed fold one command unit. With that callback, line delete, duplicate, move, and comment operations include its hidden lines, word navigation skips its interior, and new carets skip hidden lines. `onLinesMoved` tells a view where line-associated state must move.

Selection expansion uses lexical ranges and can accept host ranges through `expandSelectionTo`. Occurrence selection starts with the word under a bare caret, then searches case-matching whole words. An explicit selection searches that text inside other words too. `occurrencesExhausted` reports that the last search found no more occurrences; the next invocation can start again.

## Search and replacement

`find` returns revision-bound `FindMatch` values. `findNext` starts from an offset, includes a match at that boundary, and wraps unless `wrap: false`. `FindOptions` accepts `caseSensitive`, `wholeWord`, `regex`, bounds `from`/`to`, and `maxResults`. Matching is case-insensitive by default; literal search for an empty query returns no matches. Regex search uses JavaScript multiline and Unicode behavior.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('ITEM item Item');
const count = document.replaceAll('item', 'entry', { preserveCase: true });
console.assert(count === 3);
console.assert(document.getText() === 'ENTRY entry Entry');

const match = document.find('entry')[0];
if (match !== undefined) {
    document.setText('something else');
    console.assert(document.replace(match, 'value') === false);
}
```

`replace` refuses a match from another revision or a range whose text no longer matches. `replaceAll` applies one undo step and returns the match count, or zero for a no-op or stale revision. `ReplaceOptions.literal` disables regex replacement expansion; `preserveCase` follows the replaced text's case. `replacementText` expands capture, named-group, and JavaScript dollar patterns; `findMatches` exposes the matcher without a model. Invalid bounds throw `RangeError`; invalid regular expressions throw `SyntaxError`. A regex has no timeout.

## Folds and helpers

`getFoldingRanges` derives bracket and block-comment folds by default. Enable `indentation` explicitly. A `language` adds import runs, line-comment runs, region markers, Markdown blocks and sections, and PHP blocks/heredocs. `minLines` is the number of lines past the first line required for a fold, default 1.

Server `FoldHints` can classify symbol bodies and add server ranges the lexical rules missed. `FoldRole` values include file headers, imports, documentation comments, regions, function/method/class bodies, object/array literals, tags, attributes, PHP tags, heredocs, front matter, code fences, and tables. A role is optional; it does not prove a parsed syntax tree.

| Root helper                                                    | Use                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `scanBrackets`, `BracketIndex`                                 | Lexical bracket pairs for incomplete code                          |
| `indentationColumn`                                            | Tab-expanded indentation width                                     |
| `isWordBoundary`, `isHumpBoundary`, `wordBoundary`, `WordText` | Word navigation rules                                              |
| `changedSpan`, `changedSpans`, `TextSpan`                      | One changed stretch or a bounded line diff for replacement batches |
| `replaceWithCaseRespect`                                       | Give replacement text the match's case                             |

`TextSpan` uses `start`, `end`, and `text`; translate it to `TextEdit.from`/`to` before applying. `changedSpans` falls back to one stretch when its work budget is exceeded. See [testing and provenance](./testing-provenance) for budgets and scanner limits.
