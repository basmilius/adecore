# Files

```ts
import { writeAtomic } from '@adecore/utils/fs';
```

File helpers for Node and Bun. A page cannot import this entry point.

## Atomic writes

`writeAtomic(target, content, mode, options)` writes a temporary file next to the target and renames it over the target. A process that dies halfway leaves a stray temporary file, never half a file. `mode` defaults to `0o600`, readable by the owner only.

```ts
await writeAtomic(settingsPath, JSON.stringify(settings, null, 4));
```

A power cut can still leave an empty target on APFS and ext4. With `durable` set in `WriteAtomicOptions`, the write flushes the file before the rename and the folder after it. Use it for a file whose loss costs a person their work:

```ts
await writeAtomic(draftPath, draft, 0o600, { durable: true });
```

`writeAtomicSync` does the same without awaiting. Use it on an exit path, or under a watch reload that restarts the module before an awaited write comes back.

Writes to one file still need an order of their own. Run them through a [`Serializer`](/utils/async#one-at-a-time).

## The parts of a write

The steps are exported for code that needs one of them alone:

- `tempNameFor(target)` gives the temporary name. The temporary file is opened exclusively, so a link someone put on that name stays untouched.
- `replaceSync(temp, target, rename)` is the rename on its own. `rename` defaults to `renameSync` and lets a test refuse it.
- `syncDirectory(path)` flushes a folder. It does nothing on Windows, which cannot open a folder for it and journals the rename itself.

Both renames retry a few times when `isBusyRename(e)` says Windows refused because a scanner or an indexer held the file. That covers `EPERM`, `EBUSY` and `EACCES`, never `EMFILE` or `ENFILE`, which mean the process ran out of descriptors.

## Small checks

- `removeFile(path)` removes a file and leaves a missing one alone.
- `fileExists(path)` follows a link, so a link that leads nowhere does not count.
- `entryExists(path)` counts the link itself, also when it leads nowhere.
