# @adecore/editor-core

[![npm](https://img.shields.io/npm/v/@adecore/editor-core)](https://www.npmjs.com/package/@adecore/editor-core)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/editor-core/)

The document model of a code editor, with no DOM and no dependencies. `DocumentModel` holds the text, the selections, an undo history and the editing commands: typing with bracket pairing, smart Enter, comment toggles, line moves, multiple carets, search and folding. It runs in a browser, Bun and Node. [`@adecore/editor`](https://adecore.dev/editor/) draws it on screen.

## Install

```sh
bun add @adecore/editor-core
```

## Use

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('const greeting = "hello";\n');

document.setSelections([{ anchor: 26, head: 26 }]);
document.typeText('(', { language: 'typescript' }); // the closer comes along
document.undo();
```

Offsets are UTF-16 code units, lines and columns zero-based. A batch of edits is simultaneous, in the coordinates of the text before it.

## Documentation

| Page | What it covers |
|---|---|
| [Overview](https://adecore.dev/editor-core/) | Coordinates, limits and provenance |
| [Documents and edits](https://adecore.dev/editor-core/documents) | Text, selections, edit batches, revisions, history and change events |
| [Typing and commands](https://adecore.dev/editor-core/commands) | `typeText`, `paste`, `execute` and their options |
| [Search and folding](https://adecore.dev/editor-core/search-folding) | Find and replace, folding ranges and roles |
| [API reference](https://adecore.dev/editor-core/api) | The helpers and types next to the model |

## License

FSL-1.1-MIT, except the word-boundary predicates in `src/words.ts`, which are adapted from the IntelliJ Platform (`EditorActionUtil.java` of JetBrains/intellij-community at `7184b03af6c5370e79a01ded0df68cf56d7669da`, lines 934 through 982) under Apache 2.0. `NOTICE` and `LICENSE.apache-2.0.txt` ship with the package.
