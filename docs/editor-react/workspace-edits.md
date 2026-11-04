# Workspace edits

A rename, a code action or a server's `workspace/applyEdit` can change many files at once, and create, move or delete some. The package applies such an edit through the operations the app allows, and never writes a file on a server's word alone.

## Applying an edit

`project.applyWorkspaceEdit(edit)` applies a language server's edit, such as a rename across files. `applyWorkspaceEdit(edit, host)` does the same without a project; its `WorkspaceEditHost` has `editorOf(uri)` and `files`.

It plans the edit first with [`planWorkspaceOperations`](/lsp/edits#resource-operations), so an edit that does not fit changes nothing. Before each step it checks that open editors still hold the planned text and version, and that a delete or overwrite loses no unsaved work. A step that no longer fits stops the edit there. Steps that already ran stay applied; nothing rolls back.

- A file open in an editor takes its edits as one undo step.
- Any other file becomes an unsaved draft through `files.stage`. Nothing is written on a server's word alone.
- With moves in the edit, the drafts save through `files.save` and the moves go through `files.rename`.
- A created file goes through `files.create`, with all the text the edit writes into it. `applyWorkspaceEdit` refuses an existing target unless the edit says `ignoreIfExists`. `overwrite` needs `files.supportsOverwrite`. Closing or reloading an editor on a replaced target is up to the host.
- A deleted file or folder goes through `files.delete`.
- A version in the edit must match the editor's. The host gives `versionOf(uri)` (`project.applyWorkspaceEdit` uses `service.versionOf`); without it, the text check stands in. `applyWorkspaceEdit` refuses a version for a file no editor holds.

`WorkspaceEditHost` also takes `versionOf(uri)`, `isReadOnly(uri)` and `openUris()`. A read-only editor, from `isReadOnly(uri)` or the editor's own `isReadOnly()`, refuses the edit before any step runs.

## The files

`ProjectFiles` is the app's side, passed as `files` on the [host](/editor-react/project#languagehost):

| Method                         | What it does                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `read(path)`                   | The `DiskText` (`text`, `mtime`) of a file, from its draft or the disk; or `null`                                    |
| `stage(files)`                 | Puts `StagedFile`s (`path`, `disk`, `text`) in drafts and tells the person                                           |
| `save(files)`                  | Writes the files; returns the reason the first one failed, or `null`                                                 |
| `rename(from, to, options?)`   | Moves a file or folder; `options.overwrite` replaces a target that is there. Returns the reason it failed, or `null` |
| `create(path, text, options?)` | Optional. Makes a file; `options.overwrite` empties one that is there. Returns the reason it failed, or `null`       |
| `delete(path, { recursive })`  | Optional. Deletes a file, or a folder with what is in it; returns the reason it failed, or `null`                    |
| `isUnsaved(path)`              | Optional. Whether a draft or an open editor at the path, or under it for a folder, holds unsaved text                |
| `exists(path)`                 | Optional. Whether anything is at the path, folders and files that are not text included; see below                   |
| `isFolder(path)`               | Optional. Whether the path is a folder                                                                               |
| `supportsOverwrite`            | Optional flag. Whether `create` and `rename` take `overwrite`; without it an overwrite is refused                    |

The permission checks belong in these methods. `applyWorkspaceEdit` refuses an edit that needs a method `ProjectFiles` lacks. Pass `supportedResourceOperations(files)` as the session's `resourceOperations`, so servers only ask for what the host can do. Without `isUnsaved`, it refuses to delete a file an editor holds, and a recursive delete needs `openUris()` on the host. Without `isFolder`, deleting anything but a text file needs `recursive`. Without `exists`, it cannot honor `ignoreIfNotExists`, so `create` and `rename` must refuse an existing target themselves.

```ts
const files: ProjectFiles = {
    read: async (path) => drafts.read(path) ?? (await disk.read(path)),
    stage: (staged) => drafts.put(staged),
    save: (written) => disk.write(written),
    rename: (from, to, options) => disk.move(from, to, options)
};

const session = new LspSession(transport, { rootUri, resourceOperations: supportedResourceOperations(files) });
const project = new ProjectLanguage(service, { folder, files });
```

`drafts` and `disk` stand for the app's own storage. `save` and `rename` resolve to the reason they failed, or `null`. This host neither creates nor deletes, so `supportedResourceOperations` announces only `rename` and servers do not ask for the rest.

## Telling the servers about files

The host tells the servers, inside these methods. After `rename`, `create` or `delete` succeeds, call `project.didCreateFiles` or `project.didDeleteFiles` (or the session's `didRenameFiles`). For a file the person creates or deletes outside a server's edit:

- `project.willCreateFiles(targets)` and `project.willDeleteFiles(targets)` return the `WorkspaceEdit` the servers want first, or `null`. Apply it with `project.applyWorkspaceEdit`.
- `project.didCreateFiles(targets)` and `project.didDeleteFiles(targets)` tell the servers afterwards.

A target is a `FileOperationTarget`: an absolute path, or `{ path, directory: true }` for a folder. The project sends only the files the servers' filters take. A service without the matching optional `willCreateFiles`, `didCreateFiles`, `willDeleteFiles` and `didDeleteFiles` makes these no-ops. [Files](/lsp/files#file-operations) covers the protocol side.
