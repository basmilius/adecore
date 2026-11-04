# Reference

```ts
import { DocumentModel } from '@adecore/editor-core';
```

## DocumentModel

The members of `DocumentModel`, by what they do.

| Group      | Members                                                                                                          | Guide                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Text       | `getText`, `getLength`, `getLineCount`, `getLine`, `slice`, `positionAt`, `offsetAt`                             | [Documents](/editor-core/documents#text-and-lines)     |
| Selections | `getSelections`, `getSelectionCount`, `getPrimary`, `setSelections`, `expandSelectionTo`, `occurrencesExhausted` | [Documents](/editor-core/documents#selections)         |
| Edits      | `applyEdits`, `setText`, `undo`, `redo`, `getRevision`                                                           | [Documents](/editor-core/documents#edits)              |
| State      | `getSnapshot`, `subscribe`                                                                                       | [Documents](/editor-core/documents#snapshots-and-listeners) |
| Saving     | `markSaved`, `getModifiedLines`, `cleanUpWhitespace`                                                             | [Documents](/editor-core/documents#saving)             |
| Commands   | `typeText`, `paste`, `execute`, `wordSelectionAt`, `wordStartBefore`, `wordEndAfter`                             | [Typing and commands](/editor-core/commands)           |
| Search     | `find`, `findNext`, `replace`, `replaceAll`, `replaceMatches`                                                    | [Search](/editor-core/search)                          |
| Folding    | `getFoldingRanges`                                                                                               | [Folding](/editor-core/folding)                        |
| Lexical    | `matchBracket`, `placeAt`, `postfixOperands`, `surroundShape`, `unwrapTargets`, `findTodos`                      | [Lexical queries](/editor-core/lexical)                |

## `@adecore/editor-core`

Every name the package exports, read from its source. Anything not listed is internal.

<ExportTable entry="@adecore/editor-core" />
