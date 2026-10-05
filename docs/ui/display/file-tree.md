# File tree

`FileTree.Root` wraps `@pierre/trees` with the UI theme, 25px rows, 12px chevrons, end truncation and horizontal shifting for long names. `useFileTree` creates the model with matching defaults. Import `@adecore/ui/theme.css` and mount [`UIProvider`](/ui/utilities/ui-provider) first.

<Demo src="display/file-tree" />

## Guides

- [Getting started](/ui/display/file-tree/getting-started) covers setup, defaults, model ownership and changing paths.
- [Models, loading and expansion](/ui/display/file-tree/models-loading) covers sorting, flattened directories, mutation, lazy listings, search and persisted folds.
- [Interaction and row controls](/ui/display/file-tree/interaction-controls) covers selection, activation, real checkboxes, context menus, dragging and long names.
- [Reference and migration](/ui/display/file-tree/reference) lists `FileTreeOptions`, `FileTreeRootProps`, model types, helper contracts and engine upgrade checks.

The host owns filesystem changes, Git operations, directory/search caches and permission checks. The model owns displayed paths, selection and expansion. Options initialize that model; use its mutation methods after mount.

Rows use the terminal path of a flattened directory. `renderControl` and `renderDecoration` receive that normalized row. Put `FileTree.Checkbox` in the control slot with actual checked, mixed and disabled state; put counts and status in `FileTree.Decoration`. Controls project into sibling shadow slots outside the engine's row buttons. Pointer and keyboard isolation are tested; screen-reader behavior still needs verification in the consuming desktop runtime.

For a non-file model, [`Tree`](/ui/display/tree) shares the appearance while leaving all navigation and loading to the host. [`DatabaseExplorer`](/database/views/explorer) uses those parts for database nodes.

The wrapper targets the pinned beta.6 engine. Keep its custom-sort expansion, shadow-slot and focus timing workarounds until a dependency update has been verified. Adapted helpers retain [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/ui/src/file-tree/LICENSE), while existing UI modules retain MIT. A publication license decision remains for the adapted files.
