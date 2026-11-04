# Find

The editor has the matcher of a find bar but not the bar. The app draws its own, or uses [`FindReplace`](/editor-react/find-replace).

<Demo src="editor/find" />

## Find and replace

`find(query)` marks every match and moves to the first one from the caret. `null` removes the marks. An `EditorFindQuery` has `text`, `caseSensitive`, `wholeWord` and `regex`, and `inSelection: true` searches only what was selected when it turned on.

```ts
const stop = editor.onFind((state) => setCount(state.count));

editor.find({ text: 'total', caseSensitive: false, wholeWord: true, regex: false });
editor.findStep(1);
editor.replace('sum');
editor.endFind();
stop();
```

`onFind(listener)` reports an `EditorFindState` whenever the count changes:

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

Matches never touch the selection until `endFind`. A regular expression expands `$1` and the like in the replacement. The `EditorReplaceOptions` of `replace` and `replaceAll` hold `preserveCase`, which matches the case of the replaced text. An invalid regular expression finds nothing. A search in an empty selection never replaces the whole document.

Regular expressions run only in the [search worker](#search-worker). Literal searches run on the page. `replaceAllAsync` resolves to the number replaced and records one undo step. On overflow or a changed revision it applies nothing and resolves to `0`. `replaceAll` returns its count synchronously when all literal matches are known. Otherwise it starts `replaceAllAsync`, returns `0` and reports the result through `onFind`. A regular expression `replace` returns `true` once its worker job starts. `MAX_REPLACEMENT_PAGE` and `MAX_REPLACEMENT_CHARACTERS` from `@adecore/editor` are the replacement limits, for a host's status messages.

## Search worker

Set `searchWorker` on `createSmartEditorEngine` to a factory for a worker entry that calls `serveEditorSearch(self)`. Each editor creates its client on first use. Regular expression searches debounce and run one at a time, with a deadline of 1.5 seconds live and 10 seconds on Enter or a find step. In a document over 8 million UTF-16 units they start only on Enter or a find step. Escape ends the session and releases the worker. Without `searchWorker`, a regular expression search reports `unavailable`.

```ts
// search.worker.ts
import { serveEditorSearch } from '@adecore/editor/search-worker';

serveEditorSearch(self);
```

```ts
const engine = createSmartEditorEngine({
    tokenizer,
    searchWorker: () => new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' })
});
```

`@adecore/editor/search-worker` supplies `serveEditorSearch` for the worker entry and `createSearchClient` for a host that drives the worker itself. Importing it starts nothing. The worker runs the same `iterateMatches` as [editor-core](/editor-core/search). `serveEditorSearch` takes an `EditorSearchWorkerEndpoint`, such as `self`, and returns a cleanup function.

## Driving the worker yourself

`createSearchClient(options)` returns an `EditorSearchClient`. Its `EditorSearchClientOptions` take the `workerFactory`, a `deadline` in milliseconds and a `schedule(callback, delay)` timer, the last two for tests.

```ts
import { createSearchClient } from '@adecore/editor/search-worker';

const search = createSearchClient({ workerFactory: () => new Worker(workerUrl, { type: 'module' }) });
const result = await search.search({ revision: 1, text: 'Name: Ada' }, { text: 'Name: (\\w+)', regex: true, caseSensitive: false, wholeWord: false });

search.dispose();
```

Keep one client per document. An `EditorSearchSnapshot` is the `revision` and `text` of a document. The revision identifies the text, and the client resends the text only when the revision changes or the worker restarts.

| Method                                                 | Returns                                                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search(snapshot, query, options?)`                    | An `EditorSearchResult`: the `revision`, a transferable `Uint32Array` of `[from, to]` pairs (at most 10,000) and `limited`. `EditorSearchOptions` take `from`, `to` and `maxResults` |
| `match(snapshot, query, { from, to })`                 | An `EditorSearchMatch`, a `FindMatch` with captures and groups for one `EditorSearchRange`, or `null`, usable for preview and replace with editor-core's revision checks            |
| `next(snapshot, query, offset, options?)`              | One range or `null`; `EditorSearchNextOptions` take `backwards`, `wrap`, `from` and `to`                                                                                             |
| `replacements(snapshot, query, replacement, options?)` | One page of `EditorSearchReplacements`: `revision`, a `ranges` buffer of `[from, to, replacementLength]` triples, the joined replacement `text` and `next`, the `from` of the next page or `null`. Changes nothing |

A replacement page holds up to `maxEdits` (default 1,000, at most 10,000) and `maxCharacters` (default and maximum 4 million), set in `EditorSearchReplacementOptions`. The client refuses a single replacement larger than a page. Collect every page, refuse on any failure or changed revision, then apply all edits at once with `expectedRevision`, so the result is one undo step and never partial.

The default deadline is 1.5 seconds from posting, startup included. A timeout or a newer request terminates the worker, and the next request starts a fresh one. Of requests made in one microtask only the latest runs. `cancel` rejects pending work and keeps an idle worker. `release()` frees the worker and its snapshot and leaves the client usable. `dispose()` ends it.

Failures reject with an `EditorSearchError` whose `kind`, an `EditorSearchErrorKind`, is `timeout`, `superseded`, `unavailable`, `syntax`, `range`, `snapshot`, `error` or `disposed`. A failure before the worker's handshake stays `unavailable` for that client, so create a new client to retry. The messages between client and worker are `EditorSearchInput` and `EditorSearchOutput`.

## A worker client of your own

`@adecore/editor/worker-client` holds the request lifecycle the search client is built on, for other work that belongs in a worker. `createWorkerRequestClient(options)` returns a `WorkerRequestClient`. Its `WorkerRequestOptions` take a `workerFactory` that returns a `WorkerRequestPort` (the `Worker` methods it uses), a `deadline` (1,500 ms) and hooks to check replies.

It keeps one active and one pending request, and a newer request supersedes both. The deadline includes worker startup, and a timeout terminates the worker. `request(inputFactory, deadline?, validate?)` sends one request; `inputFactory` gets the request id. `release()` frees the worker and keeps the client usable; `dispose()` is final. A failure rejects with a `WorkerRequestError` whose `kind` is a `WorkerRequestErrorKind`: `timeout`, `superseded`, `unavailable`, `error` or `disposed`. Use a separate client for work that cancels independently.
