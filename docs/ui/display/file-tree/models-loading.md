# Models, loading and expansion

The model knows the paths you give it and nothing else. Listings, search requests, caches, permissions and filesystem changes are yours; no model method does any I/O.

## Sorting and flattened paths

`FileTree.compareRows`, the default `sort`, puts directories before files and compares names numerically, so `file2` comes before `file10`. Case only breaks a tie, and a directory comes before what it holds. A `sort` of your own receives the engine's sort entries; `SortRow` is the part of one the default needs.

With `flattenEmptyDirectories`, one row can stand for `src/utilities/` as joined segments. `FileTree.pathOfRow(row)` resolves such a row to its last directory, and `FileTree.visibleRows(model)` returns the visible rows with that path. `renderControl` and `renderDecoration` receive rows with that path too. Use these helpers when you save folds or load children, so an intermediate segment never becomes the target.

## Changing paths

```ts
import type { FileTreeModel } from '@adecore/ui';

export function addGeneratedFiles(model: FileTreeModel) {
    model.batch([
        { type: 'add', path: 'generated/types.ts' },
        { type: 'add', path: 'generated/schema.ts' }
    ]);
    model.move('generated/schema.ts', 'generated/schema-v2.ts', { collision: 'error' });
    model.remove('generated/types.ts');
}
```

`batch` groups adds, removes and moves. Removing a directory takes `{ recursive: true }`, and a move takes a `collision` of `'error'`, `'replace'` or `'skip'`. Change the filesystem first and bring the model in line with what succeeded. Dragging and renaming in the tree change the model too, so code that updates it ahead of the filesystem must undo a step that failed.

## Lazy listings

`onLoadChildren(path)` runs for every directory that opens, including the ones open at the start, and again after a close and a reopen. It returns `void`: the wrapper does not await it, shows no loading state, catches no error and cancels nothing.

The engine draws no chevron on an empty directory, so a directory whose children are not loaded yet needs a placeholder child. Start with `paths: ['src/__pending__']`, leave flattening off while it loads, and hide the placeholder through `unsafeCSS` with `[data-item-path$="/__pending__"] { display: none; }`. This relies on attributes of the pinned engine version.

A loader of your own can cache what loaded and cancel what is pending. `listChildren` returns full paths relative to the root, not bare names. Give each tree its own loader.

```ts
import type { FileTreeModel } from '@adecore/ui';

type Listing = (path: string, signal: AbortSignal) => Promise<readonly string[]>;

export function createListingLoader(model: FileTreeModel, listChildren: Listing, onError: (path: string, error: unknown) => void) {
    const cached = new Set<string>();
    const pending = new Set<string>();
    const controller = new AbortController();
    const load = (path: string): void => {
        if (cached.has(path) || pending.has(path) || controller.signal.aborted) {
            return;
        }
        pending.add(path);
        void listChildren(path, controller.signal)
            .then((paths) => {
                if (controller.signal.aborted) {
                    return;
                }
                model.batch(paths.map((child) => ({ type: 'add' as const, path: child })));
                model.remove(`${path}__pending__`);
                cached.add(path);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    onError(path, error);
                }
            })
            .finally(() => {
                pending.delete(path);
            });
    };
    return {
        load,
        invalidate: (path: string) => {
            cached.delete(path);
        },
        dispose: () => controller.abort()
    };
}
```

Pass `loader.load` as `onLoadChildren` and call `loader.dispose()` on unmount or when the root changes. `invalidate` starts no request; call `load(path)` to refresh a row that is open. This loader only adds entries: a full refresh also removes the ones that are gone, and adds placeholders for new directories. Errors and a way to retry are yours to draw.

## Remembering folds

Expansion lives in the model; there is no controlled `expandedPaths` prop. `onExpandedPathsChange` reports every change, including remembered paths that are hidden under a closed directory. The helpers reconcile what you stored with what is loaded:

```ts
import { FileTree, type FileTreeModel } from '@adecore/ui';

export function restoreExpanded(model: FileTreeModel, paths: readonly string[], remembered: ReadonlySet<string>) {
    FileTree.resetExpandedPaths(model, paths, remembered);
    const rows = FileTree.visibleRows(model).filter((row) => row.kind === 'directory');
    const known = new Set(rows.map((row) => row.path));
    const reported = new Set(rows.filter((row) => row.isExpanded).map((row) => row.path));
    return FileTree.withoutClosedBranches(FileTree.mergeExpanded(remembered, reported, known), known);
}
```

`resetExpandedPaths` resets the paths and expands a second time, because the engine restores expansion with its default sort. `mergeExpanded` keeps remembered paths the model does not know yet. `withoutClosedBranches` drops paths under a known directory that is closed. Never store only what is visible, or the folds under a directory that has not loaded are lost.

To store collapsed directories instead, use `FileTree.dirPathOf`, `FileTree.collapsedPathsOf`, `FileTree.mergeCollapsedPaths` and `FileTree.applyExpansion`, with the same `FoldKeyOf` both ways; a key of `null` leaves a directory out. `mergeCollapsedPaths` returns the same array when nothing changed, since a selection also notifies the model's subscribers. `applyExpansion` runs at most 32 passes, as an opened directory can reveal more flattened ones.

`FileTree.ancestorDirsOf(path)` lists the directories above a path, outermost first, and `FileTree.newlyExpanded(before, after)` the paths that opened between two sets.

## Search and subscriptions

The engine's search is off by default; turn it on with `search`. `openSearch`, `setSearch`, `closeSearch`, `getSearchMatchingPaths` and the next and previous match methods work on the paths the model knows and never query the filesystem. For results from a recursive or remote search, use a second model rather than replacing the listing.

`subscribe` and `onMutation` return a function that unsubscribes. Selection changes notify subscribers too, so store expansion only when it changed.
