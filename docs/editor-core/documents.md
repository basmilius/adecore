# Documents and edits

`new DocumentModel(text?)` starts a document with one caret at offset 0 and an empty history. An old snapshot keeps its own text after later edits.

## Text and lines

`getText()` builds the full string once per revision. For a small region, use `getLength()`, `getLineCount()`, `getLine(line)` or `slice(from, to)`.

```ts
const document = new DocumentModel('first\r\nsecond');

document.getLineCount(); // 2
document.getLine(1); // { start: 7, end: 13, next: 13, text: 'second' }
document.positionAt(9); // { line: 1, column: 2 }
document.offsetAt({ line: 1, column: 99 }); // 13, the end of the line
```

The model keeps the line endings it was given. A line ends at `\n`, `\r\n` or a lone `\r`, as in the language server protocol. A `\r\n` is one break outside the line's `text`. An empty document has one line, and a trailing break adds an empty last line.

`getLine` clamps an out-of-range line. `positionAt` and `offsetAt` clamp to the document and the line. `slice` is a plain substring and can split a surrogate pair.

## Selections

`getSelections()` returns copies in the order the carets were added. The last is the primary caret, which `getPrimary()` returns. The view scrolls to it and language features ask about it.

`setSelections(selections)` clamps offsets, moves ends out of a surrogate pair or a `\r\n`, and merges selections that touch or overlap. A merge that includes the primary caret stays last. An empty list becomes one caret at offset 0. It also ends the current typing group in the history.

```ts
const document = new DocumentModel('red blue red');

document.setSelections([
    { anchor: 0, head: 3 },
    { anchor: 9, head: 12 }
]);
document.typeText('green', { language: 'text' });
document.getText(); // 'green blue green'
```

## Edits

`applyEdits(edits, options?)` applies a batch of `TextEdit`s as one undo step. Every range refers to the text before the batch, so order does not matter.

```ts
const document = new DocumentModel('red blue red');
const revision = document.getRevision();

document.applyEdits(
    [
        { from: 0, to: 3, text: 'green' },
        { from: 9, to: 12, text: 'green' }
    ],
    { expectedRevision: revision, source: 'command' }
);
```

It returns `true` when the text changed, and `false` for a no-op batch or a stale `expectedRevision`. It throws a `RangeError` for an offset outside the document, `to` before `from`, an edge inside a surrogate pair, or overlapping edits (two insertions at one offset overlap). A non-string `text` throws a `TypeError`. Nothing changes when it throws.

| `DocumentEditOptions` | Meaning                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| `expectedRevision`    | Refuse the batch unless the document is at this revision                               |
| `selections`          | The selections after the edit; without them the current ones move along with the edits |
| `source`              | `'input'`, `'command'` or `'external'` (the default), passed on to listeners           |
| `historyGroup`        | Joins this batch to the previous undo step of the same group                           |
| `joinPrevious`        | Joins the previous undo step when the text is exactly as that step left it             |
| `typed`               | Marks the change as a person's typing though it ran as a command; the snapshot says so |

`setText(text)` replaces everything as one undoable `external` edit and keeps the history. Make a new model to start without one.

## Revisions

`getRevision()` rises by one with every text change, undo and redo included, and never repeats. Selection changes leave it alone. Take the revision before a slow request, such as to a language server, and pass it as `expectedRevision` with the answer. A `false` then means the text changed meanwhile.

## History

`undo()` and `redo()` return whether there was a step. A new edit clears the redo stack.

Edits with the same `historyGroup` join one undo step until the group closes: a `setSelections`, an undo, an edit without the group, or any other change in between. `typeText` uses the group `typing` by default, so a typed word undoes at once.

## Saving

The document tracks which lines changed since `markSaved()` or creation. The marks move with their text. `getModifiedLines()` returns them, zero-based and in order. A change that ends at the start of a line, such as an inserted line, does not mark that line.

`cleanUpWhitespace(options?)` cleans up whitespace before a save as one undo step and returns whether the text changed. Every `WhitespaceCleanupOptions` entry is off unless set:

| Option                     | Default | Meaning                                                                                                 |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `trailingWhitespace`       | `'off'` | `TrailingWhitespace`: strip the spaces and tabs at the end of the `'modified'` lines or of `'all'` lines |
| `keepCaretLines`           | `true`  | The lines a caret is on keep their trailing whitespace                                                  |
| `removeTrailingBlankLines` | `false` | The blank lines at the end go, up to the last line with text and its line break                         |
| `ensureFinalNewline`       | `false` | A text that does not end in a line break gets one, in the style of its first                            |
| `language`                 |         | The language id; trailing whitespace inside a multiline string of it stays                              |

It leaves the marks alone. Call `markSaved()` once the text is written.

## Snapshots and listeners

`getSnapshot()` returns an `EditorSnapshot`: `text`, `selections`, `revision`, `canUndo` and `canRedo`. A kept snapshot still returns its own text after later edits.

`subscribe(listener)` returns a `Disposable` and calls the listener synchronously after every change, not right away. A throwing listener is reported with `console.error`, and the change and the other listeners go on. A snapshot of a text change adds three fields:

- `source`: what made the change.
- `changes`: one list of `DocumentChange`s (`from`, `to`, `insertedLength`) per transaction, each relative to the text before that transaction. Undoing a typing group gives one list per keystroke.
- `contentEdits`: the same change as `ContentEdit`s with line and column positions, each relative to the text the previous edit left, as `didChange` expects.

```ts
const subscription = document.subscribe((snapshot) => {
    if (snapshot.contentEdits === undefined) {
        return; // only the selection moved
    }
    send(snapshot.contentEdits);
});

subscription.dispose();
```

The model has no `dispose`. Dispose its subscriptions and drop the reference. A retained snapshot keeps its revision's text in memory.
