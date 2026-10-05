# Models, loading and expansion

The file model knows the paths you give it. The host owns directory listings, search requests, caches, permissions and filesystem mutations. A model operation does not perform I/O.

## Sorting and flattened paths

`FileTree.compareRows` orders directory segments before file segments, then compares names numerically without using case as the primary distinction. It breaks a case-insensitive tie with the raw name and orders a shorter ancestor before its descendants. A custom `sort` receives engine sort entries; the exported `SortRow` contains the subset the default comparator needs.

With `flattenEmptyDirectories`, a row can represent `src/utilities/` as joined segments. `FileTree.pathOfRow(row)` resolves that row to the terminal directory. `FileTree.visibleRows(model)` copies visible rows with that normalized path. The wrapper passes normalized rows to control and decoration renderers. Use these helpers when saving folds or loading children so an intermediate segment does not become the action target.

## Mutation

```ts
import type { FileTreeModel } from '@adecore/ui';

export function addGeneratedFile(model: FileTreeModel) {
    model.batch([
        { type: 'add', path: 'generated/types.ts' },
        { type: 'add', path: 'generated/schema.ts' }
    ]);
    model.move('generated/schema.ts', 'generated/schema-v2.ts', { collision: 'error' });
    model.remove('generated/types.ts');
}
```

`batch` groups add/remove/move operations. Directory removal can use `{ recursive: true }`; move collision policy can be `error`, `replace` or `skip`. Choose policy in the host, then reconcile the model with the successful filesystem result. Drag/drop and renaming can also mutate the model, so an optimistic host must recover from a failed filesystem operation.

## Lazy listings

`onLoadChildren(path)` runs for newly expanded directories, including initially expanded ones. Closing and reopening runs it again. It returns `void`; the wrapper does not await a promise, expose a loading state, catch asynchronous errors or cancel a request.

An unloaded empty directory needs a placeholder child to retain beta.6's chevron. For example initialize `paths: ['src/__pending__']`, disable flattening for that loading state, and append an application rule such as `[data-item-path$="/__pending__"] { display: none; }` through `unsafeCSS`. This relies on the pinned shadow-row attributes. Recheck it on an engine upgrade.

This host-provided adapter caches successful listings and cancels requests on disposal. Its `listChildren` must return canonical paths relative to the same root, not just basenames. Give each tree/root its own loader.

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

Pass `loader.load` to `onLoadChildren`; call `loader.dispose()` on unmount or root replacement. Invalidating the cache does not start another request: call `load(path)` explicitly to refresh an already open row. This example adds entries; a full refresh adapter must also remove entries that disappeared. Add placeholders for newly discovered unloaded directories, and render retry/error UI in the host.

## Persisting expansion

There is no controlled `expandedPaths` prop. Expansion lives in the model. `onExpandedPathsChange` reports changes, while the helpers let the host reconcile its own persisted state with the loaded paths.

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

`resetExpandedPaths` applies a second expansion pass because beta.6 restores initial expansion using its default sort. `mergeExpanded` keeps remembered paths that are not known yet. `withoutClosedBranches` removes descendants of a known closed directory. Do not replace persisted state with only the visible rows or folds beneath unloaded parents will disappear.

For a collapse-set convention, persist bare directory keys through `dirPathOf`, `collapsedPathsOf`, `mergeCollapsedPaths` and `applyExpansion`. Supply the same `FoldKeyOf` in both directions; returning `null` excludes a directory. `mergeCollapsedPaths` returns the original array when unchanged, avoiding selection notifications restarting a state cycle. `applyExpansion` caps reconciliation at 32 passes as flattened rows reveal more directories.

## Search and subscriptions

Enable engine search explicitly if you want it. `openSearch`, `setSearch`, `closeSearch`, `getSearchMatchingPaths` and next/previous-match methods operate on the model's known paths. They do not query the filesystem. A separate search-results model can represent remote or recursive results without replacing the normal listing cache.

Cancel or ignore stale host search responses when the query/root changes. Keep expansion and caches separate per model. `subscribe` and `onMutation` return unsubscribe functions; call them during host cleanup. Selection changes also notify subscribers, so only persist actual expansion changes.
