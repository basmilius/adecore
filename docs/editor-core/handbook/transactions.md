# Transactions and history

`applyEdits(edits, options?)` applies a simultaneous batch in the coordinates of the text before the batch. The model sorts edits, drops identical duplicates, checks the whole batch, and applies it as one undo step. Supply disjoint ranges. Distinct insertions at the same offset are rejected; combine them into one insertion first.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('red blue red');
const revision = document.getRevision();
document.applyEdits(
    [
        { from: 0, to: 3, text: 'green' },
        { from: 9, to: 12, text: 'green' }
    ],
    { expectedRevision: revision, source: 'command' }
);

console.assert(document.getText() === 'green blue green');
document.undo();
console.assert(document.getText() === 'red blue red');
document.redo();
console.assert(document.getRevision() === revision + 3);
```

An edit must have integer offsets inside the document, `from <= to`, and string replacement text. An invalid or overlapping edit throws `RangeError` or `TypeError` before text, history, or selections change. A stale `expectedRevision` returns `false` before validation. A valid no-op also returns `false`.

## Options and selection mapping

| `DocumentEditOptions` field | Behavior                                              |
| --------------------------- | ----------------------------------------------------- |
| `expectedRevision`          | Apply only at this revision; otherwise return `false` |
| `selections`                | Set selections in the resulting text                  |
| `source`                    | `input`, `command`, or `external`; default `external` |
| `historyGroup`              | Join consecutive compatible edits into one undo step  |

Without explicit selections, the model maps the current selections through the batch. Every text change increments the revision, including undo and redo. Selection-only changes do not increment it. Revisions never count backward, so a previously computed proposal cannot become current again after undo.

`ContentEdit` entries in an emitted snapshot use a different rule: each is in the coordinates left by the previous entry. Pass those entries to a language client's incremental-change operation in their emitted order. See [events and state](./events-state#changes-for-a-language-client).

## Grouping user input

`typeText` uses the `typing` history group by default. Consecutive calls join while the selection and previous state still match. `setSelections`, undo, or an intervening incompatible edit closes that group. A call to `setSelections` closes it even if the normalized selection stays the same.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel();
document.typeText('a', { language: 'text' });
document.typeText('b', { language: 'text' });
document.undo();
console.assert(document.getText() === '');
```

Use a host-defined `historyGroup` only for a sequence that should undo together. A single formatting result usually belongs in one `applyEdits` call. New text edits clear redo history. History retains at most 200 steps, with the rope sharing unchanged chunks between states.

`setText` replaces all text as one undoable external edit. It does not clear history or silently establish a new baseline. If a host wants a new document with no history, create a new `DocumentModel` and move its subscriptions deliberately.

## Refusing stale work

Capture `getRevision()` when starting async work and use it as `expectedRevision` when the answer returns. Use the returned boolean to decide whether the work landed. For a feature that edits only a tracked substring in the DOM editor, [`trackRange`](/editor/handbook/editing#tracking-a-proposal) provides a separate way to follow the original text.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('draft');
const expectedRevision = document.getRevision();
document.setText('new draft');
const applied = document.applyEdits([{ from: 0, to: 5, text: 'answer' }], { expectedRevision });
console.assert(applied === false);
```
