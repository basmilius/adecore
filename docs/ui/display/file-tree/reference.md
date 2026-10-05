# FileTree reference

Import `FileTree`, `useFileTree`, `FileTreeOptions`, `FileTreeRootProps`, `FileTreeModel`, `FileTreeVisibleRow`, `FileTreeDragAndDropConfig`, `FileTreeDropContext`, `FileTreeDropResult`, `FoldKeyOf` and `SortRow` from `@adecore/ui`. `FileTreeModel` aliases the engine model type; it is not a constructor export. `FILE_TREE_ICONS` is the default icon map.

## Hook options

`useFileTree(options)` returns `{ model }`. `FileTreeOptions` accepts the installed engine's options except `density` and `itemHeight`. Supply `paths` or its prepared-input alternative. Common options include `initialExpansion`, `initialExpandedPaths`, `initialSelectedPaths`, `flattenEmptyDirectories`, `sort`, `gitStatus`, `icons`, `search`, `stickyFolders`, `composition`, `renaming`, `dragAndDrop`, `onSelectionChange` and `unsafeCSS`.

See [Getting started](/ui/display/file-tree/getting-started#defaults-and-ownership) for wrapper defaults. Options initialize the model; they are not controlled React props. Only the selection callback is kept current by the hook. New option callbacks captured by the engine may require a host adapter with its own current-value reference.

## Root props

| Prop                                     | Behavior                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `model`                                  | Required model.                                                                  |
| `label`                                  | Accessible name; defaults to translated `tree.label`.                            |
| `resetKey?: string`                      | Resets horizontal shift when changed.                                            |
| `selectionFollowsFocus`                  | Defaults to `true` for unmodified navigation.                                    |
| `onActivate(path)`                       | Normal file click or Enter on a file.                                            |
| `onFocusMove(path)`                      | Changed focus reported by the wrapper's selection-following flow.                |
| `onLoadChildren(path)`                   | Newly expanded directory; `void` callback, no managed async lifetime.            |
| `onExpandedPathsChange(paths)`           | Expansion report, including remembered paths hidden beneath other rows.          |
| `onRowContextMenu(path, targets, event)` | Native `MouseEvent`, host opens the menu.                                        |
| `onRowDragStart(path, targets, event)`   | Native `DragEvent`, after engine drag data.                                      |
| `renderControl(row)`                     | Current React content before the label; normalized terminal path.                |
| `renderDecoration(row)`                  | Current React content at the trailing end.                                       |
| `treeProps`                              | Engine React host props except `model`, including header/context-menu rendering. |
| `className`, `ref`, `render`             | Frame styling, element reference and Base UI rendering.                          |

Callbacks are optional. The wrapper owns event listeners and its expansion subscription. There is no `onLoadError` or controlled expansion prop. Native host props in `treeProps` target the inner engine tree; ordinary root element props target the frame.

## Helpers

| Helper                                                | Result or purpose                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `FileTree.directoryHandle(model, path)`               | Expandable handle or `null`.                                      |
| `FileTree.pathOfRow(row)`                             | Terminal path of a flattened row.                                 |
| `FileTree.visibleRows(model)`                         | Visible rows with normalized paths.                               |
| `FileTree.resetExpandedPaths(model, paths, expanded)` | Whole-path reset and beta.6 custom-sort expansion pass.           |
| `FileTree.applyExpansion(model, collapsed, keyOf?)`   | Apply collapse keys, at most 32 passes.                           |
| `FileTree.collapsedPathsOf(rows, keyOf?)`             | Collapsed directory keys.                                         |
| `FileTree.mergeCollapsedPaths(current, rows, keyOf?)` | Preserve hidden folds; same array when unchanged.                 |
| `FileTree.expansionChanges(rows, collapsed, keyOf?)`  | `FileTree.{ collapse, expand }` path arrays.                      |
| `FileTree.dirPathOf(path)`                            | Remove one trailing slash for a stored bare key.                  |
| `FileTree.ancestorDirsOf(path)`                       | Outer-to-inner ancestor directories.                              |
| `FileTree.mergeExpanded(remembered, reported, known)` | Preserve remembered unknown directories.                          |
| `FileTree.withoutClosedBranches(open, known)`         | Remove descendants beneath known closed branches.                 |
| `FileTree.newlyExpanded(before, after)`               | Paths added to the open set.                                      |
| `FileTree.compareRows(left, right)`                   | Directory-first numeric segment comparison.                       |
| `FileTree.selectOnly(model, path)`                    | Replace selection; `null` clears it.                              |
| `FileTree.focusRow(model, path)`                      | Focus mounted shadow row; boolean success.                        |
| `FileTree.followFocus(model, onMoved?)`               | Defer selection until focus moves; returns cancellation function. |
| `FileTree.movesFocus(event)`                          | Unmodified arrow, Home or End key.                                |
| `FileTree.extendsSelection(event)`                    | Shift, Control or Command modifier.                               |
| `FileTree.rowPathOf(event)`                           | Row path from native composed event path, or `null`.              |
| `FileTree.menuTargetsOf(row, selected)`               | Multi-selection containing row, or only row.                      |

`FoldKeyOf` is `(rowPath: string) => string | null`. `SortRow` has `isDirectory` and readonly `segments`. These helper contracts carry host compatibility conventions; changing package names does not require changing stored folds.

## Migration and engine updates

Replace local row styling, icon mapping, 25px sizing, 12px chevrons, truncation and horizontal-shift code with the wrapper. Keep ordering overrides, filesystem/Git commands, listing/search caches, path resolution, creation placeholders and persisted key conventions in the host. Replace drawn checkbox markers with `FileTree.Checkbox` and move status into `renderDecoration`.

The wrapper targets `@pierre/trees` beta.6. Before changing it, verify custom-sort expansion after reset, flattened terminal paths, shadow selectors, slot layout, focus timing, modifier selection, control isolation, truncation and shifting. Run the file-tree helper, DOM, interaction and shift tests, then verify the desktop runtime and screen reader.

Adapted helper files retain [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/ui/src/file-tree/LICENSE); existing UI modules retain MIT. Package metadata records the mixed terms. A publication license decision remains for the adapted files; these docs do not relicense them.
