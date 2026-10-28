# Storage

A host keeps everything in its data folder. Give each host its own folder. The stores assume one writer, and the file helpers guard against half-written files, not against a second process.

## What goes where

| Path in the data folder                         |                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `chats/<id>.json`                               | A chat's record: `{ info, items, seq?, resetSeq?, preambles?, uiAccess? }` and the host's own extras. |
| `chats/<id>.log`                                | Its events since the record, one JSON line each: `{ seq, at, event }`.                                |
| `chats/<id>.payloads/<sha-256>.gz`              | Its large tool outputs and checkpoint diffs, gzipped. See [Large outputs](#large-outputs).            |
| `chats/<id>.bookmarks.json`                     | Its bookmarks.                                                                                        |
| `chats/<id>.visuals.json`                       | Its [visuals](/agents/chats#visuals), as `{ version: 1, visuals }`.                                   |
| `attachments/<id>/`                             | The files attached to its messages, and the page of each visual as `<visual id>.html`.                |
| `providers.json`                                | The accounts, as `{ version: 1, accounts }`, without secrets.                                         |
| `accounts/`                                     | The folders of accounts the host made.                                                                |
| `usage/history.jsonl`                           | The usage of every transcript ever read. See [Usage](#usage).                                         |
| `usage/scan-state.json`                         | Where the usage scan left each transcript it can still see.                                           |
| `usage/prices.json`, `usage/exchange-rate.json` | The prices and rate last fetched.                                                                     |
| `outbox/`, `tasks/`, `lineage/`, `notices/`     | The [coordination](/agents/coordination) stores, when a host uses them.                               |

## Usage

The CLIs remove old transcripts, but what a transcript counted stays in `usage/history.jsonl`. That file is the only record of it and cannot be rebuilt. Back it up if usage history matters.

- Deleting `scan-state.json` resets the scan cache. Every transcript still on disk is read again, and the usage of removed transcripts stays.
- Deleting `history.jsonl` resets the history. Only transcripts still on disk count again.
- A crash between the two writes never counts anything twice.
- A `usage/index.json` from an earlier version migrates on first load. An unreadable one becomes `index.json.unreadable`.

An id becomes a file name with `encodeURIComponent`. A host's extras sit at the top level of a chat's record, next to `info` and `items`, which they cannot replace. `ChatStoreOptions.isSidecar` keeps your own JSON files in `chats/` out of the chat list.

A record this version cannot read stays untouched and fails with `chat-unreadable`. Creating the chat again does not overwrite it. A log can rebuild a missing record when it holds a start. `ChatStore.settled` reads only each record's `info` and the log's last info, so `recoverInterrupted` stays cheap.

## Large outputs

A tool's `output` or a turn's `checkpointDiff` past `CHAT_PAYLOAD_INLINE_BYTES` (64 KiB) is stored apart. The record keeps the beginning, and the item gets a ref to the whole as `{ id, bytes }`: `outputRef` on a tool, `checkpointDiffRef` on a turn. `id` is the SHA-256 of the whole.

- `chat.toolOutput { chatId, itemId }` returns the whole output (`ChatCore.toolOutput`), and `chat.turnDiff` the whole diff. Anyone who may send requests about the chat may send these.
- A missing payload fails with `payload-missing`.
- Records from earlier versions move their large values out on the next read.
- A fork copies the payloads it names, so removing the original leaves the fork whole. A clear lets its payloads go.
- A loaded chat and its attached clients keep its own outputs whole until the chat is opened again. Thread search and agents reading a chat as text see only the beginning.

## Writing

`ChatCore` batches writes. `save` and `persisted(chatId)` wait for one. `after(since)` returns the events after a sequence number while the log holds them all. Otherwise a client gets a full snapshot. `host.close()` writes every record, even mid-turn, and ends the CLIs even when a write fails. `persistAllSync` is for an exit that cannot wait.

## File helpers

```ts
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeAtomic, Serializer } from '@adecore/agents';

export async function writeCounter(dataDir: string): Promise<number> {
    await mkdir(dataDir, { recursive: true });
    const path = join(dataDir, 'counter.json');
    await writeAtomic(path, JSON.stringify({ count: 0 }));
    const writes = new Serializer();
    const increment = (): Promise<void> =>
        writes.run(async () => {
            const current = JSON.parse(await readFile(path, 'utf8')) as { count: number };
            await writeAtomic(path, JSON.stringify({ count: current.count + 1 }), 0o600, { durable: true });
        });
    await Promise.all([increment(), increment()]);
    await writes.idle();
    return (JSON.parse(await readFile(path, 'utf8')) as { count: number }).count;
}
```

The count ends at 2. `Serializer.run` runs work one at a time, also after a failure, and each caller gets its own result or error. `idle()` waits for the queue without rethrowing. `KeyedSerializer` does the same per key.

`writeAtomic(target, content, mode = 0o600, { durable? })` writes a temporary file beside the target and renames it over. `durable` also syncs the file and its folder (not on Windows). Create the folder first. `writeAtomicSync` and `replaceSync` are the synchronous forms, without `durable`. `fileExists` returns `false` on any error, so use `isNotFound` when other errors should surface. `fileExists` follows links. `entryExists` does not, so it also counts a dangling link, as a free-name check needs.

`RecordDirectory<T>` is a folder of JSON records, validated by a schema on load and written one at a time per id. A record that does not parse stays on disk. `keep` can rewrite or drop records on load. `write` and `remove` replace the file operations in tests.

## Other helpers

- `runProcess(command, options)` runs a short command in its own process group and returns its output and `exitCode` (`null` after a signal). A nonzero exit is a result, not an error. `timeoutMs` rejects and kills the group. Output past 16 MB does the same, so use it for commands that print little.
- `SingleFlight<T>.run(key, work)` runs `work` once per key at a time, and concurrent callers share the outcome. `get` and `has` tell whether a key runs.
- `cancellableTimeout(ms, run)` and `unrefTimeout(ms, run)` return a cancel function. The second does not hold the process open. `hasErrorCode(error, ...codes)` checks a caught error for system codes.
- `withTimeout(promise, ms, message)` rejects at a deadline without stopping the work. `wait(ms, signal?)` resolves early on abort.
- `WatchSeams` is swappable file watching. `SYSTEM_WATCH` uses `fs.watch`, recursive where the platform supports it (`supportsRecursive`). `settled(seams, ms, run)` runs once after a burst of changes. `PerClientWatches` keeps a watch per client and path.
- `cleanTitle` and `readLines` read titles from a transcript. `readLines` stops at the last whole line.
- `CodedError` is an error with a `code`. `errorText` and `describeError` format an error for a log. `setErrorStacks` turns stack traces on or off for the package.

## Generated image attachments

The Codex adapter validates generated image bytes (PNG, JPEG, GIF, WebP) and never reads the path where the provider saved them. `AttachmentStore.saveGenerated(chatId, ref, upload)` stores the image under the provider's item id and never overwrites one. A repeated completion reuses the file. A replay with other bytes under the same id fails. `ChatCore.attachment` finds generated images as well as attached files.

`AttachmentStore.copy(chatId, attachment)` gives a fork its own copy with the same id, so deleting the original leaves the fork's images.
