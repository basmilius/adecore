# FileTree reference

`FileTree`, `useFileTree` and the types below come from `@adecore/ui`. `FileTreeModel`, `FileTreeVisibleRow`, `FileTreeDragAndDropConfig`, `FileTreeDropContext` and `FileTreeDropResult` are the engine's own types under these names; `FileTreeModel` is a type, not a class you construct. `FILE_TREE_ICONS` is the icon set the hook passes by default.

## useFileTree

`useFileTree(options)` returns `{ model }`. `FileTreeOptions` is every option of the engine except `density` and `itemHeight`: `paths` (or its prepared form), `initialExpansion`, `initialExpandedPaths`, `initialSelectedPaths`, `flattenEmptyDirectories`, `sort`, `gitStatus`, `icons`, `search`, `stickyFolders`, `composition`, `renaming`, `dragAndDrop`, `onSelectionChange`, `unsafeCSS` and the rest.

The options create the model once; they are not controlled props. The hook keeps only `onSelectionChange` current. Another callback the engine holds on to may keep the function it was first given, so read changing values in it through a ref. The defaults are on the [overview](/ui/display/file-tree#defaults-and-ownership).

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
| `treeProps` | engine React props without `model` | | For the engine's own tree element, such as its header or context menu rendering. |
| `render` | `RenderProp` | | Another element to be the frame. |

Every other prop goes to the frame, a `<div>`. The rows passed to the render functions carry the path of the last directory of a flattened row. There is no `onLoadError` and no controlled expansion. `FileTreeRootProps` is the type.

## Parts

`FileTree.Checkbox`, `FileTree.Control` and `FileTree.Decoration` are the [`Tree`](/ui/display/tree/reference#controls) parts of the same name, drawn in the row slots. See [Interaction and row controls](/ui/display/file-tree/interaction-controls#checkboxes-and-decorations).

## Helpers

| Helper | Returns or does |
| --- | --- |
| `FileTree.directoryHandle(model, path)` | The directory's handle, or `null` for a file. |
| `FileTree.pathOfRow(row)` | The path of the last directory of a flattened row. |
| `FileTree.visibleRows(model)` | The visible rows, with that path. |
| `FileTree.resetExpandedPaths(model, paths, expanded)` | Resets the paths and expands `expanded` in a second pass. |
| `FileTree.applyExpansion(model, collapsed, keyOf?)` | Folds and opens directories to match `collapsed`, in at most 32 passes. |
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
| `FileTree.followFocus(model, onMoved?)` | Selects the focused row after the engine moved it; returns a cancel function. |
| `FileTree.movesFocus(event)` | Whether a key is an arrow, Home or End without a modifier. |
| `FileTree.extendsSelection(event)` | Whether Shift, Ctrl or Cmd is down. |
| `FileTree.rowPathOf(event)` | The row path of an event, through the shadow root, or `null`. |
| `FileTree.menuTargetsOf(row, selected)` | The selection when it holds the row and more, otherwise the row alone. |

`FoldKeyOf` is `(rowPath: string) => string | null`. `SortRow` is `{ isDirectory, segments }`.

## Moving from a tree of your own

The wrapper replaces row styling, icon mapping, the 25 pixel rows, the 12 pixel chevrons, truncation and the sideways shift. Keep your sort overrides, file and Git commands, listing and search caches, path resolution, placeholders and the keys you store folds under. Replace a drawn checkbox with `FileTree.Checkbox`, and move status into `renderDecoration`.

## Engine updates

The wrapper depends on internals of `@pierre/trees` `1.0.0-beta.6`. Before you move to another version, check expansion with a custom sort after a reset, the paths of flattened rows, the shadow root selectors, the slot layout, the timing of focus, selection with a modifier, isolation of the row controls, truncation and the sideways shift, then the file tree's tests and a screen reader in the desktop runtime.
