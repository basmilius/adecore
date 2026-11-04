# @adecore/utils

Small helpers that several packages and apps wrote for themselves. The package has no dependencies. Every entry point is a subpath, and there is no root import, so a page never loads a module that needs Node.

```sh
bun add @adecore/utils
```

| Entry point             | Runs in        | What it holds                                          |
| ----------------------- | -------------- | ------------------------------------------------------ |
| `@adecore/utils/async`  | a page or Node | waits, deadlines, timers and the order of async work   |
| `@adecore/utils/errors` | a page or Node | reading a thrown value                                 |
| `@adecore/utils/record` | a page or Node | the plain object guard                                 |
| `@adecore/utils/fs`     | Node or Bun    | atomic writes and small file checks                    |
| `@adecore/utils/path`   | Node or Bun    | whether a path lies inside a folder                    |

## async

`wait(ms, signal)` resolves after `ms`. An abort resolves it early instead of rejecting, because the loops that wait check the signal on their next turn.

`withDeadline(promise, ms, message, timer)` rejects with `message` once `ms` passed and clears its timer either way. The `DeadlineTimer` it takes lets a test drive the clock. `withTimeout` is the same on the system timer.

A `Timer` runs a callback after a delay and returns how to cancel it. `cancellableTimeout` keeps the process alive until it fires; `unrefTimeout` does not.

`Serializer` runs one piece of work at a time. The next starts once the one before settled, kept or broken, and every caller gets its own result. `idle()` resolves when the queue is empty. `KeyedSerializer` does the same per key, drops a key once its last work settled, and reports through `size` how many keys still have work.

`SingleFlight` runs work once per key at a time. A caller that asks while it runs gets the same promise; `get` and `has` look up the run in flight.

```ts
import { KeyedSerializer, withTimeout } from '@adecore/utils/async';

const writes = new KeyedSerializer();

export function saveRecord(id: string, write: () => Promise<void>): Promise<void> {
    return writes.run(id, () => withTimeout(write(), 10_000, `Saving ${id} took too long.`));
}
```

## errors

`hasErrorCode(e, ...codes)` checks the `code` that Node and Bun put on a system error, and `isNotFound(e)` checks for `ENOENT`. `describeError(error, debug)` turns a thrown value into one line, or its stack with `debug` set. A compiled Bun binary prints an Error object with a frame of minified source, so log the string instead. `asError(thrown)` wraps anything that is not an Error so a rejection can carry it.

A sentence for a person to read is a different thing from a log line. The UI package keeps its own helper for that, and a host that wants stacks in its logs decides that in its own code.

## record

`isRecord(value)` is true for a plain object and false for `null` and arrays. Use it on input from the wire or a file before you read its fields.

## fs

`writeAtomic(target, content, mode, options)` writes a temporary file next to the target and renames it over the target. A process that dies halfway leaves a stray temporary file, never half a file. With `durable` set in `WriteAtomicOptions` it flushes the file before the rename and the folder after it. Without that flush, APFS and ext4 can keep an empty target after a power cut. `writeAtomicSync` does the same without awaiting, for an exit path or a reload that will not wait for a promise.

`tempNameFor(target)` gives the temporary name. The temporary file is opened exclusively, so a link someone put on that name stays untouched. `replaceSync(temp, target)` is the rename on its own. Both renames retry a few times when `isBusyRename(e)` says Windows refused because a scanner or an indexer held the file. That covers `EPERM`, `EBUSY` and `EACCES`, never `EMFILE` or `ENFILE`, which mean the process ran out of descriptors.

`syncDirectory(path)` flushes a folder, and does nothing on Windows, which cannot open a folder for it. `removeFile(path)` removes a file and leaves a missing one alone. `fileExists(path)` follows a link; `entryExists(path)` counts a link that leads nowhere.

## path

`climbsOut(rel)` reads a path that `path.relative` returned: `..`, a path through `..` and an absolute path leave the folder, while a name such as `..cache` does not. `isWithin(folder, path)` counts the folder itself, `isBelow(folder, path)` does not.

```ts
import { realpath } from 'node:fs/promises';
import { isBelow } from '@adecore/utils/path';

export async function servable(root: string, file: string): Promise<boolean> {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);

    return isBelow(realRoot, realFile);
}
```

Both compare text after `path.relative` normalized it, with the platform's separator, drive letters and case rules. They read nothing from the disk, so a link inside the folder that points outside still counts as inside. Resolve the real path first, as above, and hold a handle on the file when another process could swap it between the check and the write. Which folders a caller may touch is up to the app.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/utils/LICENSE).
