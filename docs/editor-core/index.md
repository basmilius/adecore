# Editor core

`@adecore/editor-core` is the document model of a code editor, with no DOM. `DocumentModel` holds the text, the selections, the undo history and the editing commands, including bracket pairing, smart Enter, multiple carets, search and folding. It runs in a browser, Bun and Node, so the same editing logic works in a view, a worker or a test.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('const greeting = "hello";\n');

document.setSelections([{ anchor: 26, head: 26 }]);
document.typeText('(', { language: 'typescript' });
document.getText(); // 'const greeting = "hello";\n()'
document.undo();
```

## What it does

- Keeps the text in the line endings it was given and converts between offsets and line and column positions.
- Applies batches of edits as one undo step, with a revision that guards slow answers such as a language server's.
- Types the way a code editor does: closing brackets and quotes, wrapping a selection, indenting on Enter, continuing comments.
- Runs 59 editing commands on every caret at once, from duplicating a line to moving a statement.
- Finds and replaces, with regular expressions and case preservation, and lists folding ranges with their roles.
- Answers lexical questions about the code: matching brackets, whether an offset is in a string or a comment, TODO comments and documentation comments.
- Reports every change with the positions a language server's `didChange` expects.

## What it leaves to the app

The package draws nothing and reads no keys. [`@adecore/editor`](/editor/) draws a model and maps keys to its commands. The model holds no file either. Reading, saving, drafts and whether a person may save stay with the host. It knows no language server, but it takes a server's folding ranges and selection ranges when the host passes them.

## Where to next

- [Getting started](/editor-core/getting-started) installs the package and takes a document through edits, typing, undo and change events.
- [Documents and edits](/editor-core/documents) covers coordinates, lines, selections, edit batches, revisions, history, saving and listeners.
- [Typing and commands](/editor-core/commands) covers `typeText`, `paste`, the commands of `execute` and their options.
- [Search](/editor-core/search) covers find and replace, on a model or on a plain string.
- [Folding](/editor-core/folding) covers folding ranges and the roles a view folds by default.
- [Lexical queries](/editor-core/lexical) covers brackets, places in the code, TODO and documentation comments, and indentation.
- [Reference](/editor-core/reference) lists the members of `DocumentModel` and every export.

## Limits

- Typing, Enter, comments and folding use lexical scanners, not parsers. A `/` after an ambiguous construct can read as a regular expression or a division. The scanners do not model JSX text, Python triple quotes or HTML tag pairs.
- A language is a string id, such as `typescript` or `php`. An unknown id has no comments and no brackets, so nothing pairs, toggles or indents.
- Auto-indent uses brackets, keywords and the previous line, not a formatter. It skips languages without braces, JSX elements, Vue templates, PHP markup, and string and comment bodies.
- Search, folding and selection expansion scan the whole document synchronously on each call. A regular expression has no timeout, so run untrusted patterns in a worker.
- Crossing one very long word with word movement is slow.
- History keeps the last 200 steps.
- Columns are UTF-16 code units, not graphemes. The model has no notion of bidirectional text.
- The runtime needs `Intl.Segmenter`, which deletion by grapheme uses.

## License and provenance

The package is FSL-1.1-MIT, except the word-boundary predicates in `src/words.ts`. Those are adapted from `EditorActionUtil.java` of the IntelliJ Platform (JetBrains/intellij-community at `7184b03`, lines 934 through 982) under Apache 2.0, and the package ships `NOTICE` and `LICENSE.apache-2.0.txt` for them. Everything else is original. Bracket and quote typing follow the documented behavior of IntelliJ's handlers without using their code.
