# Events and state

`getSnapshot()` returns an `EditorSnapshot` containing selections, revision, `canUndo`, `canRedo`, and text. Text is lazy and tied to that version's rope: keeping a snapshot and reading its text after another edit still returns the earlier text. Changing a snapshot field does not change the model.

`subscribe(listener)` returns a `Disposable`. It does not call the listener immediately. Read the initial snapshot yourself, then subscribe to subsequent text and selection changes. Notifications run synchronously; a listener exception can escape the mutating call. Keep listeners small and handle host errors within them.

```ts
import { DocumentModel, type EditorSnapshot } from '@adecore/editor-core';

const document = new DocumentModel('first');
let state: EditorSnapshot = document.getSnapshot();
const subscription = document.subscribe((next) => {
    state = next;
});

document.setText('second');
console.assert(state.text === 'second');
subscription.dispose();
```

A selection-only event contains no `changes`, `contentEdits`, or `source`. A text-change event adds those fields. `changes` has one list per transaction folded into the event, with each list in the text coordinates before that transaction. An undo of a grouped typing step can therefore contain several lists.

## Changes for a language client

`contentEdits` is a sequential list of `ContentEdit` values with `{ start, end, text }`. Core positions use `column`; [`@adecore/lsp`](/lsp/handbook/) uses `character`. Translate the field name, preserve order, and serialize async sends in the host.

This adapter uses real public types. `send` is a host-provided function that applies one batch of sequential language changes. The adapter returns the subscription and a way to wait for queued sends; it does not open or close a language document.

```ts
import { DocumentModel } from '@adecore/editor-core';
import type { ContentChange } from '@adecore/lsp';

export function forwardChanges(document: DocumentModel, send: (changes: readonly ContentChange[]) => Promise<void>, onError: (error: unknown) => void) {
    let pending = Promise.resolve();
    const subscription = document.subscribe((snapshot) => {
        if (snapshot.contentEdits === undefined) {
            return;
        }
        const changes = snapshot.contentEdits.map((edit): ContentChange => ({
            range: {
                start: { line: edit.start.line, character: edit.start.column },
                end: { line: edit.end.line, character: edit.end.column }
            },
            text: edit.text
        }));
        pending = pending.then(() => send(changes)).catch(onError);
    });
    return { subscription, settled: () => pending };
}
```

Open the language document with the model's initial text before subscribing, or explicitly queue changes during opening. Dispose the subscription before closing it. An error callback that recovers the promise queue must also decide whether the language document needs reopening with current text.

The DOM editor already exposes `onTextChange` in LSP positions. Its [`ProjectLanguage`](/editor-react/handbook/host-integration) integration handles document acquisition and queuing, so a React host normally does not need this lower-level adapter.

## State ownership

The model owns its text, normalized selections, revision, and history. It has no global document registry and no dispose method. Dispose every subscription when its owner ends, and release the model reference to release retained history. Keeping old snapshots also keeps their rope states alive.

Persistence belongs to the host. Store text and user-visible state in the host's format; reconstruct a model on reload. Revisions are local sequencing values, not durable file versions or collaboration clocks.
