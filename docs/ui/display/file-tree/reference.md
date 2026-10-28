# FileTree reference

`FileTree`, `useFileTree` and the types below come from `@adecore/ui`. `FileTreeModel`, `FileTreeVisibleRow`, `FileTreeDragAndDropConfig`, `FileTreeDropContext` and `FileTreeDropResult` are the engine's own types under these names; `FileTreeModel` is a type, not a class you construct. `FILE_TREE_ICONS` is the icon set the hook passes by default.

## useFileTree

`useFileTree(options)` returns `{ model }`. `FileTreeOptions` is every option of the engine except `density` and `itemHeight`: `paths` (or its prepared form), `initialExpansion`, `initialExpandedPaths`, `initialSelectedPaths`, `flattenEmptyDirectories`, `sort`, `gitStatus`, `icons`, `search`, `stickyFolders`, `composition`, `renaming`, `dragAndDrop`, `onSelectionChange`, `unsafeCSS` and the rest.

The options create the model once; they are not controlled. The hook keeps only `onSelectionChange` current, so read changing values in other callbacks through a ref. The defaults are on the [overview](/ui/display/file-tree#defaults-and-ownership).

## FileTree.Root

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `model` | `FileTreeModel` | | Required. |
| `label` | `string` | "Files" | The tree's accessible name (`tree.label`). |
| `resetKey` | `string` | | Puts the sideways shift back at zero when it changes. |
| `selectionFollowsFocus` | `boolean` | `true` | Selects the row the arrow keys land on. |
| `onActivate` | `(path: string) => void` | | A plain click or Enter on a file. |
| `onFocusMove` | `(path: string) => void` | | Focus moved to another row, while selection follows focus. |
| `onLoadChildren` | `(path: string) => void` | | A directory opened. Not awaited. |
| `onExpandedPathsChange` | `(paths: readonly string[]) => void` | | Every open directory, including remembered ones under a closed directory. |
| `onRowContextMenu` | `(path, targets, event: MouseEvent) => void` | | Your code opens the menu. |
| `onRowDragStart` | `(path, targets, event: DragEvent) => void` | | After the engine wrote its drag data. |
| `renderControl` | `(row: FileTreeVisibleRow) => ReactNode` | | Drawn before the icon. |
| `renderDecoration` | `(row: FileTreeVisibleRow) => ReactNode` | | Drawn after the name. |
| `rowIcon` | `(row: FileTreeVisibleRow) => LucideIcon \| undefined` | | A 14 pixel icon in place of the row's file icon or chevron; `undefined` keeps it. |
| `fitContent` | `boolean` | `false` | As tall as its rows, up to the height its container leaves it. |
| `highlight` | `string` | `''` | Marks where this occurs in every name, ignoring case, in `--match`. |
| `emptyLabel` | `(row: FileTreeVisibleRow) => string \| undefined` | | A muted line under an open directory with nothing in it; `undefined` draws none. See [empty directories](/ui/display/file-tree/models-loading#empty-directories). |
| `decorationOrder` | `'before-status' \| 'after-status'` | `'before-status'` | Whether the decoration comes before or after the git status column. |
| `treeProps` | engine React props without `model` | | For the engine's own tree element, such as its header or context menu rendering. |
| `render` | `RenderProp` | | Another element to be the frame. |

Every other prop goes to the frame, a `<div>`. There is no `onLoadError` and no controlled expansion. `FileTreeRootProps` is the type.

## Parts

`FileTree.Checkbox`, `FileTree.Control` and `FileTree.Decoration` are the [`Tree`](/ui/display/tree/reference#controls) parts of the same name, drawn in the row slots. See [Interaction and row controls](/ui/display/file-tree/interaction-controls#checkboxes-and-decorations).

## Helpers

| Helper | Returns or does |
| --- | --- |
| `FileTree.directoryHandle(model, path)` | The directory's handle, or `null` for a file. |
| `FileTree.pathOfRow(row)` | The path of the last directory of a flattened row. |
| `FileTree.visibleRows(model)` | The visible rows, with that path. |
| `FileTree.resetExpandedPaths(model, paths, expanded)` | Resets the paths and expands `expanded` in a second pass. |
| `FileTree.applyExpansion(model, collapsed, keyOf?)` | Folds and opens directories to match `collapsed`. |
| `FileTree.collapsedPathsOf(rows, keyOf?)` | The keys of the closed directories. |
| `FileTree.mergeCollapsedPaths(current, rows, keyOf?)` | `current` with the visible folds applied; the same array when nothing changed. |
| `FileTree.expansionChanges(rows, collapsed, keyOf?)` | `{ collapse, expand }`, the paths that differ from `collapsed`. |
| `FileTree.dirPathOf(path)` | The path without its trailing slash. |
| `FileTree.ancestorDirsOf(path)` | The directories above a path, outermost first. |
| `FileTree.mergeExpanded(remembered, reported, known)` | `reported` plus the remembered paths the model does not know yet. |
| `FileTree.withoutClosedBranches(open, known)` | `open` without the paths under a known closed directory. |
| `FileTree.newlyExpanded(before, after)` | The paths in `after` that were not in `before`. |
| `FileTree.compareRows(left, right)` | Directories first, then names in numeric order. |
| `FileTree.selectOnly(model, path)` | Selects one path; `null` clears the selection. |
| `FileTree.focusRow(model, path)` | Focuses a drawn row; `false` when it is not drawn. |
| `FileTree.rebuildPaths(model, paths, fold, applying)` | Resets the paths, moving selection and focus to the nearest row when theirs went. `fold` runs in between with `applying.current` set, so you can ignore the fold reports it causes. |
| `FileTree.followFocus(model, onMoved?)` | Selects the focused row after the engine moved it; returns a cancel function. |
| `FileTree.movesFocus(event)` | Whether a key is an arrow, Home or End without a modifier. |
| `FileTree.extendsSelection(event)` | Whether Shift, Ctrl or Cmd is down. |
| `FileTree.rowPathOf(event)` | The row path of an event, through the shadow root, or `null`. |
| `FileTree.menuTargetsOf(row, selected)` | The selection when it holds the row and more, otherwise the row alone. |

`FoldKeyOf` is `(rowPath: string) => string | null`. `SortRow` is `{ isDirectory, segments }`.

## Moving from a tree of your own

The wrapper replaces row styling, icon mapping, row and chevron sizes, truncation and the sideways shift. Keep your sort overrides, file and Git commands, listing and search caches, path resolution, placeholders and fold keys. Replace a drawn checkbox with `FileTree.Checkbox`, and move status into `renderDecoration`.

## Engine updates

The wrapper depends on internals of `@pierre/trees` `1.0.0-beta.6`, so it pins that version.
