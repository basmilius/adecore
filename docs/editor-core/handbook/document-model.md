# Text, positions, and selections

The model preserves the text's line endings and indexes lines by LF. CRLF is one break, with its CR excluded from the line text. A lone CR does not start a new core line. An empty document has one line, and a trailing LF adds an empty last line. `getLine(line)` clamps an out-of-range line and returns a `DocumentLine` with `start`, `end`, `next`, and `text`; `end` excludes the break and `next` is the next line's start. The LSP edit helpers also recognize lone CR, so normalize that line-ending case in a host that connects the two.

## Choose the right coordinates

| Shape                      | Coordinates                                             | End boundary                    |
| -------------------------- | ------------------------------------------------------- | ------------------------------- |
| `Selection`                | UTF-16 offsets `anchor` and `head`                      | Direction is preserved          |
| `TextEdit` / `OffsetRange` | UTF-16 offsets `from` and `to`                          | Half-open `[from, to)`          |
| Core `Position`            | Zero-based `line`, UTF-16 `column`                      | Column excludes the line break  |
| DOM editor / LSP position  | Zero-based `line`, UTF-16 `character`                   | Same unit, different field name |
| `FoldingRange`             | Zero-based inclusive line numbers and half-open offsets | Fold ends at `endLine`          |

UTF-16 offsets are JavaScript string offsets. An emoji can occupy two code units, and a visible grapheme can occupy more. Tabs occupy one code unit even when they draw several columns. Use the view's geometry to answer screen-position questions.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('A😀\r\nB');
const secondLine = document.getLine(1);
const afterEmoji = document.positionAt(3);
const offset = document.offsetAt({ line: 1, column: 1 });

console.assert(secondLine.start === 5);
console.assert(afterEmoji.line === 0 && afterEmoji.column === 3);
console.assert(offset === 6);
```

`positionAt` and `offsetAt` clamp to the document and line bounds. Selection normalization avoids a surrogate-pair split or the middle of CRLF. `slice(from, to)` has ordinary UTF-16 substring semantics and can split a surrogate pair; it is a text-reading operation, not an edit validator. `applyEdits` rejects boundaries that split a surrogate pair. Do not use clamping to validate an external edit; validate its intended range before applying it.

## Primary and multiple selections

`getSelections()` returns copies in selection order. The last selection is the primary one; `getPrimary()` returns its copy. The primary selection determines which caret a view follows and which position a language feature normally asks about.

`setSelections` clamps endpoints, merges touching or overlapping selections, and keeps a merged primary selection last. An empty input becomes a caret at offset zero. A selection with `anchor > head` runs backward. Normalize the endpoints only when an operation needs an unordered range.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('red blue red');
document.setSelections([
    { anchor: 0, head: 3 },
    { anchor: 9, head: 12 }
]);
document.typeText('green', { language: 'text' });

console.assert(document.getText() === 'green blue green');
console.assert(document.getSelectionCount() === 2);
```

Calls that return selections do not transfer ownership of the model's arrays. Keep host decorations, persistence, and collaboration records separately. The model does not choose a file name, save text, or track a project.

## Reading without flattening

Use `getLength`, `getLineCount`, `getLine`, and `slice` when a feature only needs a small region. `getText()` flattens the persistent rope and caches the result for that version. A selection listener should not read the entire text on every movement.

See [events and state](./events-state) for retained snapshots and [resource limits](./testing-provenance#resource-limits) for operations that intentionally read all text.
