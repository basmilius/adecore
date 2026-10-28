# Find and folding

## Find

The editor has the matcher of a find bar but not the bar. The app draws its own, or uses [`FindReplace`](/editor-react/find-replace).

<Demo src="editor/find" />

`find(query)` marks every match and moves to the first one from the caret. `null` removes the marks. An `EditorFindQuery` has `text`, `caseSensitive`, `wholeWord` and `regex`, and `inSelection: true` searches only what was selected when it turned on. `onFind(listener)` reports an `EditorFindState` whenever the count changes:

- `count`, and the zero-based `current` match or `null`.
- `noSelection` when a search in the selection has nothing selected.
- `limited: true` when more matches exist than the 10,000 marked. With `current: null` the current match lies past the marked ones, and the view still highlights it.
- `searching`, `failed` (`invalid`, `timeout`, `unavailable` or `error`) and `large` for worker searches.
- `replaced`, `replaceFailed` and `captureFailed` after a worker replacement or capture lookup.

| Method                              | What it does                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `findStep(direction)`               | Moves to the next (`1`) or previous (`-1`) match                                   |
| `replace(replacement, options?)`    | Replaces the current match and moves on; `false` without a match or when read-only |
| `replaceAll(replacement, options?)` | Replaces every match in one undo step and returns how many                         |
| `setReplacePreview(replacement)`    | Draws what a regular expression writes for the current match; `null` removes it    |
| `selectFindMatches()`               | Ends the find with a caret on every match and returns how many                     |
| `endFind()`                         | Removes the marks and selects the current match                                    |
| `findFromCursor(query, direction)`  | Selects the next match from the caret without a find bar                           |

Matches never touch the selection until `endFind`. A regular expression expands `$1` and the like in the replacement, and `preserveCase: true` matches the case of the replaced text. An invalid regular expression finds nothing. A search in an empty selection never replaces the whole document.

Regular expressions run only in the [search worker](#search-worker). Literal searches run on the page. `replaceAllAsync` resolves to the number replaced, or `0` when refused: on overflow or a changed revision it applies nothing, otherwise it records one undo step. `replaceAll` returns its count synchronously when all literal matches are known. Otherwise it starts `replaceAllAsync`, returns `0` and reports the result through `onFind`. A regular expression `replace` returns `true` once its worker job starts. `MAX_REPLACEMENT_PAGE` and `MAX_REPLACEMENT_CHARACTERS` from `@adecore/editor` are the replacement limits, for a host's status messages.

## Search worker

Set `searchWorker` on `createSmartEditorEngine` to a factory for a worker entry that calls `serveEditorSearch(self)`. Each editor creates its client on first use. Regular expression searches debounce and run one at a time, with a deadline of 1.5 seconds live and 10 seconds on Enter or a find step. In a document over 8 million UTF-16 units they start only on Enter or a find step. Escape ends the session and releases the worker. Without `searchWorker`, a regular expression search reports `unavailable`.

`@adecore/editor/search-worker` supplies `serveEditorSearch` for the worker entry and `createSearchClient` for a host that drives the worker itself. Importing it starts nothing. The worker runs the same `iterateMatches` as editor-core.

```ts
// search.worker.ts
import { serveEditorSearch } from '@adecore/editor/search-worker';
serveEditorSearch(self);
```

```ts
import { createSearchClient } from '@adecore/editor/search-worker';

const search = createSearchClient({ workerFactory: () => new Worker(workerUrl, { type: 'module' }) });
const result = await search.search({ revision: 1, text: 'Name: Ada' }, { text: 'Name: (\\w+)', regex: true, caseSensitive: false, wholeWord: false });
search.dispose();
```

Keep one client per document. A snapshot's revision identifies its text, and the client resends the text only when the revision changes or the worker restarts.

| Method                                                | Returns                                                                                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search(snapshot, query, options?)`                   | The `revision`, a transferable `Uint32Array` of `[from, to]` pairs (at most 10,000) and `limited`. Takes `from`, `to` and `maxResults`. Selection bounds come from the caller            |
| `match(snapshot, query, { from, to })`                | A `FindMatch` with captures and groups for one range, or `null`, usable for preview and replace with editor-core's revision checks                                                       |
| `next(snapshot, query, offset, options?)`             | One range or `null`, with `backwards`, `wrap`, `from` and `to`                                                                                                                            |
| `replacements(snapshot, query, replacement, options?)` | One page: `revision`, a `ranges` buffer of `[from, to, replacementLength]` triples, the joined replacement `text` and `next`, the `from` of the next page or `null`. Changes nothing     |

A replacement page holds up to `maxEdits` (default 1,000, at most 10,000) and `maxCharacters` (default and maximum 4 million). A single replacement larger than a page is refused. Collect every page, refuse on any failure or changed revision, then apply all edits at once with `expectedRevision`, so the result is one undo step and never partial.

The default deadline is 1.5 seconds from posting, startup included. A timeout or a newer request terminates the worker, and the next request starts a fresh one. Of requests made in one microtask only the latest runs. `cancel` rejects pending work and keeps an idle worker. `release()` frees the worker and its snapshot and leaves the client usable. `dispose()` ends it. `deadline` and a `schedule(callback, delay)` timer can be injected for tests.

Failures reject with an `EditorSearchError` whose `kind` is `timeout`, `superseded`, `unavailable`, `syntax`, `range`, `snapshot`, `error` or `disposed`. A failure before the worker's handshake stays `unavailable` for that client, so create a new client to retry. `serveEditorSearch` returns a cleanup function.

## Folding

The editor reads the model's [folding ranges](/editor-core/search-folding#folding-ranges) for its language shortly after the text changes. Python and YAML also fold by indentation. Line commands treat a collapsed fold as one row: delete, duplicate, comment, move and copy without a selection take its hidden lines along.

`getFolds()` returns `EditorFolds`: the `collapsed` ranges and the `custom` ones made from a selection, as zero-based lines. Store it with the scroll position and caret, and pass it back as `folds` when the file reopens.

`foldDefaults` lists the [roles](/editor-core/search-folding#roles) that fold when a file opens without stored folds, such as `['imports', 'file-header']`. They fold once, never a range the person toggled or one holding the caret, and nothing after the first edit. Ranges a language server names later through hints fold too.

`setFoldHints(hints)` passes what a language server knows: `symbols` with their `range` and `body` kind, and `ranges` (`EditorFoldRangeHint`) with their `kind`. They name the function, method and class bodies. A range with `startCharacter` or `endCharacter` folds within its first and last lines, so an import list collapses to `use …;`. `null` clears the hints.

Fold commands go through [`runCommand`](/editor/editing#commands). For the gutter controls, see [accessibility](/editor/#accessibility).

## Blocks and sticky scroll

The editor finds a document's blocks, the stretches with a header line such as a function, from brackets and indentation. Sticky scroll pins the headers of blocks scrolled out of view, up to five lines and a quarter of the view. `onScope(listener)` reports the named blocks around the caret, outermost first, for a breadcrumb.

`setBlocks(blocks)` replaces those blocks, for example with a language server's symbols. An `EditorBlock` has one-based `startLine` and `endLine`, and an optional `name` and `kind`. `null` goes back to the editor's own.

`setSelectionRanges(provider)` lets Extend Selection use a language server's ranges. `null` goes back to the model's.

`runCommand('nextChange')` and `runCommand('previousChange')` (`Ctrl+Alt+Shift+ArrowDown` and `ArrowUp`) move the caret to the next or previous run of change marks from `setChangeMarks`. They do not wrap.

`setDeclarations(positions)` sets where Method Up and Down (`methodUp`, `methodDown`) stop, such as a language server's symbol names. The stops follow their text until set again. `null` goes back to the editor's own structure and Markdown headings. The commands do not wrap. `onNavigate(listener)` reports the position the caret left after Method Up and Down and the code block commands. `hasFocus()` tells whether the editor has keyboard focus.
