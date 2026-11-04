# Getting started

None of this page needs a DOM, so every example runs as is in `bun test`.

## Install

```sh
bun add @adecore/editor-core
```

The package has no peer dependencies and no styles. It brings `@adecore/utils` along.

## A document

`new DocumentModel(text)` starts a document with one caret at offset 0 and an empty history. Offsets count UTF-16 code units, and lines and columns count from zero.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('let total = 0;\n');

document.getLineCount(); // 2, since the trailing line break starts an empty line
document.getLine(0); // { start: 0, end: 14, next: 15, text: 'let total = 0;' }
document.getRevision(); // 0
```

## Edit the text

`applyEdits` replaces ranges as one undo step. Every range refers to the text before the batch.

```ts
document.applyEdits([{ from: 0, to: 3, text: 'const' }], { source: 'command' }); // true
document.getText(); // 'const total = 0;\n'
document.getRevision(); // 1
```

## Type like a person

`typeText` is one keystroke on every caret. A single character gets code editor behavior, so an opening bracket brings its closer and the caret lands between them.

```ts
document.setSelections([{ anchor: 17, head: 17 }]);

document.typeText('print', { language: 'typescript' });
document.typeText('(', { language: 'typescript' });
document.getText(); // 'const total = 0;\nprint()'
document.getSelections(); // [{ anchor: 23, head: 23 }]

document.typeText('total', { language: 'typescript' });
document.getText(); // 'const total = 0;\nprint(total)'
```

`execute` runs the other commands, such as `duplicateLine` or `toggleLineComment`. [Typing and commands](/editor-core/commands) lists them.

## Undo and redo

Consecutive `typeText` calls join one undo step, so the typed line goes at once. The edit before it is its own step.

```ts
document.undo(); // true
document.getText(); // 'const total = 0;\n'

document.undo(); // true
document.getText(); // 'let total = 0;\n'
document.getSnapshot().canUndo; // false
```

## Listen to changes

`subscribe` calls the listener after every change. A text change carries `contentEdits`, the line and column edits a language server's `textDocument/didChange` expects. A selection change has none.

```ts
const subscription = document.subscribe((snapshot) => {
    if (snapshot.contentEdits === undefined) {
        return;
    }

    // [{ start: { line: 0, column: 0 }, end: { line: 0, column: 3 }, text: 'const' }]
    send(snapshot.contentEdits);
});

document.applyEdits([{ from: 0, to: 3, text: 'const' }]);
subscription.dispose();
```

`send` stands for whatever forwards the change, such as an `LspDocument` of [`@adecore/lsp`](/lsp/documents). The protocol calls the column `character`; the unit is the same.

## Checklist

- Pass the `language` id to `typeText`, `paste` and `execute`. Without it they treat the text as TypeScript.
- Take `getRevision()` before a slow request and pass it back as `expectedRevision`, so an answer for old text changes nothing.
- Dispose every subscription. The model itself has no `dispose`.
- Keep a snapshot only as long as needed, since it holds its revision's text in memory.
