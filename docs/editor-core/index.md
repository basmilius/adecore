# @adecore/editor-core

The document model of a code editor, with no DOM and no dependencies. `DocumentModel` holds the text, selections, undo history and editing commands, from bracket pairing and smart Enter to multiple carets, search and folding. It runs in a browser, Bun and Node.

```sh
bun add @adecore/editor-core
```

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('const greeting = "hello";\n');

document.setSelections([{ anchor: 26, head: 26 }]);
document.typeText('(', { language: 'typescript' });
document.getText(); // 'const greeting = "hello";\n()'
document.undo();
```

[`@adecore/editor`](/editor/) draws a model and maps keys to its commands. Use this package alone for editing logic without a view, such as in a test or a worker.

## What is in it

- [Documents and edits](/editor-core/documents): text, lines, selections, edit batches, revisions, history and change events.
- [Typing and commands](/editor-core/commands): `typeText`, `paste` and the commands of `execute`, with their options.
- [Search and folding](/editor-core/search-folding): find and replace, and folding ranges.
- [API reference](/editor-core/api): the helpers next to the model, such as `changedSpans`, `scanBrackets` and the word predicates.

## Coordinates

Every offset is a UTF-16 code unit, like a JavaScript string index. Lines and columns are zero-based. An emoji takes two code units and a tab takes one.

| Shape          | Fields                     | Meaning                                                      |
| -------------- | -------------------------- | ------------------------------------------------------------ |
| `Selection`    | `anchor`, `head`           | Offsets; `anchor > head` is a backward selection             |
| `TextEdit`     | `from`, `to`, `text`       | Replaces the half-open range `[from, to)`                    |
| `Position`     | `line`, `column`           | Zero-based line and UTF-16 column                            |
| `ContentEdit`  | `start`, `end`, `text`     | Two positions, in the order a language server applies them   |
| `FoldingRange` | `startLine`, `endLine`, .. | Zero-based inclusive lines plus offsets                      |

The view and LSP packages call the column `character`. The unit is the same.

## Limits

- Typing, Enter, comments and folding use lexical scanners, not parsers. A `/` after an ambiguous construct can read as a regular expression or a division. JSX text, Python triple quotes and HTML tag pairs are not modeled.
- A language is a string id, such as `typescript` or `php`. An unknown id has no comments and no brackets, so nothing pairs, toggles or indents.
- Auto-indent uses brackets, keywords and the previous line, not a formatter. It skips languages without braces, JSX elements, Vue templates, PHP markup, and string and comment bodies.
- Search, folding and selection expansion scan the whole document synchronously on each call. A regular expression has no timeout, so run untrusted patterns in a worker.
- Crossing one very long word with word movement is slow.
- History keeps the last 200 steps.
- Columns are UTF-16 code units, not graphemes. The model has no notion of bidirectional text.
- The runtime needs `Intl.Segmenter`, which deletion by grapheme uses.

## License and provenance

The package is FSL-1.1-MIT, except the word-boundary predicates in `src/words.ts`. Those are adapted from `EditorActionUtil.java` of the IntelliJ Platform (JetBrains/intellij-community at `7184b03`, lines 934 through 982) under Apache 2.0, and the package ships `NOTICE` and `LICENSE.apache-2.0.txt` for them. Everything else is original. Bracket and quote typing follow the documented behavior of IntelliJ's handlers without using their code.
