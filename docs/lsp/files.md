# Files

Servers know files by URI and want to hear when files change, appear, move or go. The package converts paths, matches changes against what a server watches and sends the notifications. Watching the disk and changing files stay with the app.

## Paths and URIs

`pathToFileUri(path)` makes a `file:` URI of a POSIX or Windows path, escaping each segment. `fileUriToPath(uri)` goes back, or returns `null` for another scheme. Neither checks that a path is inside the project.

```ts
import { fileUriToPath, pathToFileUri } from '@adecore/lsp';

pathToFileUri('/work/my file.ts'); // 'file:///work/my%20file.ts'
fileUriToPath('file:///work/my%20file.ts'); // '/work/my file.ts'
fileUriToPath('untitled:Untitled-1'); // null
```

Make every URI with `pathToFileUri`, so one file never shows up under two spellings.

## Watched files

`session.watchedFiles()` returns the watchers the server registered. `watchesFile(watchers, root, path, type)` says whether a change concerns them. `type` is a `FileChangeType`: `1` created, `2` changed or `3` deleted. Send matches with `session.didChangeWatchedFiles(changes)`.

```ts
import { pathToFileUri, watchesFile } from '@adecore/lsp';

disk.onChange((path, type) => {
    if (watchesFile(session.watchedFiles(), '/work', path, type)) {
        void session.didChangeWatchedFiles([{ uri: pathToFileUri(path), type }]);
    }
});
```

`disk` stands for the app's own watcher. A path in `node_modules`, `vendor` or `.git` only matches a pattern that names that folder.

## File operations

When a person renames, creates or deletes a file, a server may want to update other files first, such as the imports that point at a moved file. The session has a `will` and a `did` method for each operation:

| Operation | Methods                              | Entries                                  |
| --------- | ------------------------------------ | ---------------------------------------- |
| Rename    | `willRenameFiles`, `didRenameFiles`  | `RenamedFile` (`oldUri`, `newUri`, `directory`) |
| Create    | `willCreateFiles`, `didCreateFiles`  | `CreatedFile` (`uri`, `directory`)       |
| Delete    | `willDeleteFiles`, `didDeleteFiles`  | `DeletedFile` (`uri`, `directory`)       |

A `will` method returns the server's `WorkspaceEdit`, or `null`. Apply it as any other [workspace edit](/lsp/edits#workspace-edits) before the files change, then call the `did` method. A server asked before a delete expects the files to still exist.

```ts
const files = [{ oldUri: pathToFileUri(from), newUri: pathToFileUri(to), directory: false }];
const edit = await session.willRenameFiles(files);

if (edit !== null) {
    await applyEdit(edit);
}

await moveFile(from, to);
await session.didRenameFiles(files);
```

`applyEdit` and `moveFile` stand for the app's own steps. The session sends only the files the server's filters accept. `fileOperationFilters(operation)` returns those filters, for a host that wants to check first.
