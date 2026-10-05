# Editing, selections, and events

`EditorPosition` is `{ line, character }` with zero-based lines and UTF-16 characters. `EditorRange` is `{ start, end }`. `positionAt`, `offsetAt`, and `textInRange` convert between offsets and positions. Positions past a line or document end clamp; a host must validate an external edit's intended coordinates before passing it in.

## Text updates and notifications

| Operation / event        | Meaning                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `getText()`              | Current full text                                                           |
| `setText(text)`          | External replacement, diffed to preserve surrounding caret and scroll state |
| `onChange(listener)`     | User/command text changes; excludes `setText`                               |
| `onTextChange(listener)` | Every text change, including `setText`, undo, and redo                      |
| `onSave(listener)`       | Mod+S inside the editor; no file write is performed                         |
| `onBlur(listener)`       | Focus left the editor and its own widgets                                   |
| `onCaret(listener)`      | Primary caret moved or text under it changed                                |

Every subscription returns an unsubscribe function. Dispose subscriptions before their host owner ends. `EditorTextChange` contains `source: 'input' | 'command' | 'external'` and sequential `changes` in the coordinates left by the previous entry. Send that order to a language service. Subscribe to `onChange` for dirty-state handling when a reload should not mark the file dirty; subscribe to `onTextChange` for synchronization.

`setText` is undoable and uses a bounded diff. It does not clear undo history, change the file's identity, or reset a host's saved baseline. Read-only mode prevents user commands and `applyEdits`, but the host can still replace text with `setText`.

## Applying a command result

Despite sharing the `EditorContentChange` shape with event changes, `applyEdits` accepts a simultaneous batch against the current document. Each range refers to the text before the entire batch. It returns `false` for read-only, empty, invalid, overlapping, or no-op edits. A valid batch is one undo step. Do not replay an `onTextChange` list through `applyEdits` without translating its sequential coordinates.

```ts
import type { Editor } from '@adecore/editor';

export function replaceTwoWords(editor: Editor): boolean {
    return editor.applyEdits([
        {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
            text: 'green'
        },
        {
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } },
            text: 'green'
        }
    ]);
}
```

The example expects `red blue red` on the first line. Validate language-server edits with the [`LSP text helpers`](/lsp/handbook/documents-edits) if positions came from untrusted or stale results. The view has no `expectedRevision` option; language results need the service's stale-result guarantee or a tracked-range guard.

## Carets and navigation

`getSelection()` returns the ordered primary range. `getSelections()` returns all ranges, primary last. `setSelection` creates one selection with the caret at its end; `setSelections` uses the last input as primary and leaves state unchanged for an empty list. The view contract does not expose core anchor/head direction.

`setCaret` moves and reveals one caret. `revealLine` uses a one-based line number. Reveal modes are `relative`, `center`, `centerDown`, and `centerUp`; the latter two preserve a useful direction while stepping through results. `runCommand` accepts core editing commands and view commands for folding and column mode. It reports whether anything changed.

`onClick` handlers see a primary text click before built-in selection, and the first handler returning `true` owns it. `EditorClick` includes platform `mod`, `alt`, and `shift`. `onContextMenu` reports the position, selection membership, and screen `x`/`y`; it does not draw a menu or move the caret. Navigation between files belongs to the host.

## Tracking a proposal

`trackRange` follows the original text through edits and undo. It returns `null` after an edit replaces any of that text or inserts strictly inside it. Insertions exactly at its endpoints preserve the original text, moving it behind an insertion at its start. A disposed range always returns `null`.

```ts
import type { Editor, EditorRange } from '@adecore/editor';

export function proposalGuard(editor: Editor, range: EditorRange) {
    const original = editor.textInRange(range);
    const tracked = editor.trackRange(range);
    return {
        apply(replacement: string): boolean {
            const current = tracked.get();
            if (current === null || editor.textInRange(current) !== original) {
                return false;
            }
            return editor.applyEdits([{ range: current, text: replacement }]);
        },
        dispose: () => tracked.dispose()
    };
}
```

Dispose the guard on acceptance, rejection, cancellation, or editor teardown. Tracking maps two offsets per change per range; keep a bounded set of active proposals.
