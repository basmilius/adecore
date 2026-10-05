# @adecore/editor-core

The document model of a code editor, with no DOM and no dependencies. `DocumentModel` holds the text, the selections, the undo history and the editing commands: typing with bracket pairing, smart Enter, comment toggles, line moves, multiple carets, search and folding. It runs in a browser, Bun and Node.

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

[`@adecore/editor`](/editor/) draws a model on screen and turns keys into its commands. Use this package alone for editing logic without a view, such as in a test or a worker.

## What is in it

- [Documents and edits](/editor-core/documents): text, lines, selections, simultaneous edit batches, revisions, undo history and change events.
- [Typing and commands](/editor-core/commands): `typeText`, `paste` and the 45 commands of `execute`, with the options that turn each behavior off.
- [Search and folding](/editor-core/search-folding): find and replace with regular expressions and preserved case, and folding ranges with roles.
- [API reference](/editor-core/api): the helpers next to the model, such as `changedSpans`, `scanBrackets` and the word predicates.

## Coordinates

Every offset is a UTF-16 code unit, the same as a JavaScript string index. Lines and columns are zero-based. An emoji takes two code units and a tab takes one, however wide it is drawn.

| Shape          | Fields                     | Meaning                                                      |
| -------------- | -------------------------- | ------------------------------------------------------------ |
| `Selection`    | `anchor`, `head`           | Offsets; `anchor > head` is a backward selection             |
| `TextEdit`     | `from`, `to`, `text`       | Replaces the half-open range `[from, to)`                    |
| `Position`     | `line`, `column`           | Zero-based line and UTF-16 column                            |
| `ContentEdit`  | `start`, `end`, `text`     | Two positions, in the order a language server applies them   |
| `FoldingRange` | `startLine`, `endLine`, .. | Zero-based inclusive lines plus offsets                      |

The view and the LSP packages call the column `character` instead of `column`. The unit is the same.

## Limits

- The scanners behind typing, Enter, comments and folding are lexical, not parsers. A `/` after an ambiguous construct can read as a regular expression or a division. JSX text, Python triple quotes and HTML tag pairs are not modeled. The markup around PHP tags and heredoc and nowdoc bodies are lexer modes of their own.
- A language is a string id, such as `typescript` or `php`. An id the lexer does not know has no comments and no brackets, so nothing in it pairs, toggles or indents.
- Auto-indent works from brackets, keywords and the previous line, not from a formatter. It leaves alone languages without braces, JSX elements, Vue templates, PHP markup and the bodies of strings and comments.
- Search, folding and selection expansion read the whole document, synchronously, on each call. A regular expression has no timeout, so run untrusted patterns in a worker.
- Word movement reads every character it crosses, so one very long word is slow to cross.
- History keeps the last 200 steps. The text has no size cap.
- Columns are UTF-16 code units, not graphemes. The model has no notion of bidirectional text.
- The package creates an `Intl.Segmenter` when it loads, to delete by grapheme, so the runtime needs one.

## License and provenance

The package is FSL-1.1-MIT, except the word-boundary predicates in `src/words.ts`. Those are adapted from `EditorActionUtil.java` of the IntelliJ Platform (JetBrains/intellij-community at `7184b03`, lines 934 through 982) under Apache 2.0, and the package ships `NOTICE` and `LICENSE.apache-2.0.txt` for them. Everything else is written for this package: the rope, history, commands, search, folding and the lexical scanners. Bracket and quote typing were checked against the documented behavior of IntelliJ's handlers; none of their code is used.
