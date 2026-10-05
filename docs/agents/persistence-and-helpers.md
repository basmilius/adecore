# Persistence and helpers

Choose one stable host data root and one writer per store. The filesystem helpers protect against partial writes and local write races; they do not provide cross-process transactions or authorization.

## Stored files

| Relative path under the data root               | Owner and format                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `chats/<encoded-id>.json`                       | Chat snapshot `{ info, items, seq?, resetSeq?, preambles?, ...hostExtras }` |
| `chats/<encoded-id>.log`                        | Append-only JSON lines `{ seq, at, event }`                                 |
| `chats/<encoded-id>.bookmarks.json`             | Bookmark sidecar                                                            |
| `attachments/<encoded-chat-id>/`                | Attachment bytes; stored items refer to backend absolute paths              |
| `providers.json`                                | Account map wrapped as `{ version: 1, accounts }`; secrets excluded         |
| `accounts/`                                     | Account folders created by the account service                              |
| `usage/index.json`                              | Versioned usage scanner index                                               |
| `usage/prices.json`, `usage/exchange-rate.json` | Cached external data                                                        |
| `outbox/`, `tasks/`, `lineage/`, `notices/`     | Optional per-record coordination stores                                     |

`recordFileName(id)` uses `encodeURIComponent(id) + '.json'`. Preserve this encoding and ids during migration. `ChatStoreOptions.isSidecar` excludes your own JSON sidecars when listing chats. Host extras use top-level fields; they cannot override `info`, `items`, `seq`, `resetSeq`, or `preambles`.

`ChatStore` reads a snapshot with its replay log applied. Snapshot info/items use contract schemas and strip unknown nested fields; unknown top-level extras remain available to the host. An unreadable chat is left on disk and refused as `chat-unreadable`, rather than overwritten by `create`. A log can recover a missing/unreadable snapshot only when it contains a usable starting event. Old inline attachments migrate through the attachment store when configured.

## Logs, saves, and replay

`ChatLog.append` writes a whole event synchronously and returns its sequence. `after(since)` returns replay events only while the sequence/reset window is available; otherwise attach falls back to a snapshot. Compaction folds covered events into the snapshot and eventually removes old log lines. A truncated final line is not a complete event. `parseLog` validates events and keeps increasing sequence numbers. `ChatLog` detects sequence gaps and restricts replay to its remaining contiguous suffix.

`ChatCore` writes small records promptly, debounces larger records, and coalesces deltas. Await `save` or `persisted(chatId)` for an explicit write boundary. Shutdown flushes snapshots even if a live turn has not finished and still disposes all processes when a write fails. A consumer can use `persistAllSync` for an exit/reload path that cannot await, but ordinary shutdown should await `shutdown`/`host.close`.

## Atomic writes and serialization

```ts
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeAtomic } from '@adecore/agents/fs';
import { Serializer } from '@adecore/agents/serializer';

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

The result is 2. `Serializer.run` queues work even after a prior rejection; each caller still receives its own result/error. `idle()` waits for queued work to settle without rethrowing its errors. `KeyedSerializer` orders each id separately and allows independent records to proceed concurrently.

`writeAtomic(target, content, mode = 0o600, { durable? })` writes a unique neighboring temp file and renames it. The caller creates the parent directory. Transient permission/busy rename failures retry up to five times at 40 ms. Durable writes fsync the file before rename and the parent directory afterward except on Windows. Ordinary atomic writes protect against a process crash, not every power-loss case. A failed/crashed write can leave a temp file.

`writeAtomicSync` and `replaceSync` provide synchronous rename paths; they have no durable fsync option. `fileExists` returns false for any stat error, not only absence. Use `isNotFound` when other filesystem errors need to propagate.

`RecordDirectory<T>` validates records on load, stores them in memory, and serializes writes by id. Unreadable records stay on disk. An optional `keep` adapter may transform or drop expired records; returning null removes their file. `write` changes memory immediately and resolves to a boolean describing whether the write still represented a live record. Reads return stored objects, so callers should avoid mutating them in place.

## Watchers

`WatchSeams` injects directory watching and scheduling. `SYSTEM_WATCH` uses `fs.watch`; `supportsRecursive` selects recursive watching only on macOS and Windows. `settled(seams, delay, run)` debounces nudges and exposes `stop` to cancel the queued callback. It does not await/abort a callback already running.

`PerClientWatches` keys state by client and path. Removing a watch or detaching a client calls your stop function. `put` replaces a map value without disposing an existing state; remove it first when replacing a live watch. OS watch errors and missed notifications require consumer-specific rescan/recovery behavior. `FakeWatch` and `EventLog` provide deterministic verification.

## Process and asynchronous helpers

`runProcess(command, { cwd, env, stdin, timeoutMs, timeoutMessage })` collects stdout/stderr and returns `exitCode`, which is null on signal exit. Empty commands and launch failures reject. A nonzero exit is a returned result; the caller decides whether it is an error. The optional timeout sends SIGTERM and rejects. This helper has no bounded output buffer or descendant group cleanup, so use it for short controlled commands.

`spawnChatProcess`/`ChatChild` instead manage a chat's process group and bounded stderr tail. `StreamTail` retains the end of stderr for a crash note. `withTimeout` rejects a promise at a deadline without cancelling its underlying operation. `wait` resolves on an abort event rather than rejecting; a caller's loop must still inspect its signal.

`title-file` supplies `cleanTitle` and chunked `readLines` for append-only transcripts. The latter returns the byte offset after the last complete line, so a partially written line is read later. `error-text` supplies display/debug formatting; `setErrorStacks` changes its package-wide stack formatting policy.
