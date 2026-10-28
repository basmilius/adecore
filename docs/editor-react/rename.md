# Rename and code actions

## Rename

<Demo src="editor/rename" />

`language.rename.start()` (Shift+F6) opens the rename card over the name at the caret. With `prepareProvider`, it asks `textDocument/prepareRename` for the range and placeholder; otherwise it takes the word at the caret. Other uses of the name light up while the card is open.

Enter renames. Shift+Enter first previews the changed lines by file, with Enter to apply. Escape or an edit in the file cancels. A refusal from the service stays under the input. The edit goes through [`applyWorkspaceEdit`](/editor-react/project#workspace-edits). The preview also lists `Creates`, `Moves` and `Deletes` rows from `RenameView.operations`.

With `suggestNames` on the [host](/editor-react/project#languagehost), the card shows suggested names. The callback gets the name, its kind (`function`, `class`) when known, the surrounding code, a few uses and an `AbortSignal`.

## Code actions

<Demo src="editor/code-actions" />

`language.codeActions.open()` (Alt+Enter) lists the actions for the caret or selection, grouped as quick fixes, rewrites, extractions, inlines, moves, refactorings, source actions and the rest. A disabled action shows the server's reason. A lightbulb in the gutter marks a line with a fix and opens the same list.

| Method                       | What it lists or does                                |
| ---------------------------- | ---------------------------------------------------- |
| `open()`                     | All actions for the caret or selection               |
| `refactorThis()`             | Only the refactorings, structure first               |
| `quickFixFor(problem)`       | The fixes of one problem                             |
| `organizeImports()`          | Applies the server's `source.organizeImports` action |
| `formatDocument()`           | Formats the file with the editor's indentation       |
| `list(only)`, `apply(entry)` | The entries of some kinds, and one applied           |

An action's preview notes the other files it edits, moves, creates and deletes. Applying resolves it through `codeAction/resolve` when needed, applies its edit through the project and runs its command. A command's `workspace/applyEdit` requests go through the same `applyWorkspaceEdit`.

## Context menu

A right click opens the context menu: a Go to submenu (definition, declaration, type definition, implementation), peek references and call hierarchy, rename, code actions and a refactorings submenu, then cut, copy, paste and format document. Rows only appear where the service supports them, each with its key. A right click outside the selection moves the caret first.

`contextMenuItems` on `EditorView` or `LanguagePopups` adds the app's own group between the refactorings and the clipboard rows. It gets the `EditorLanguage`:

```tsx
<EditorView
    {...props}
    contextMenuItems={(language) => (
        <ContextMenu.Item onClick={() => copyText(language.uri)}>Copy file address</ContextMenu.Item>
    )}
/>
```
