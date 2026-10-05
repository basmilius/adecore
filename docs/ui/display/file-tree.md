# FileTree

A tree of file paths, drawn in the library's theme on the `@pierre/trees` engine (pinned at `1.0.0-beta.6`). `useFileTree` creates the model, and `FileTree.Root` draws it with 25 pixel rows, 12 pixel chevrons, names truncated at the end and a sideways shift for names that do not fit.

```tsx
import { FileTree, useFileTree } from '@adecore/ui';
```

<Demo src="display/file-tree" />

For nodes that are not file paths, such as connections or database objects, use [`Tree`](/ui/display/tree), which shares the look and leaves the model to you.

## A file browser

```tsx
import { useState } from 'react';
import { FileTree, useFileTree } from '@adecore/ui';

export function ProjectFiles() {
    const [opened, setOpened] = useState<string | null>(null);
    const { model } = useFileTree({
        paths: ['src/index.ts', 'src/utilities/path.ts', 'README.md'],
        initialExpansion: 'open',
        flattenEmptyDirectories: true
    });
    return (
        <div>
            <FileTree.Root model={model} label="Project files" className="h-64" onActivate={setOpened} />
            {opened !== null && <p>{opened}</p>}
        </div>
    );
}
```

Paths are POSIX and relative to a root you choose. A directory path ends in `/`, a file path does not, and the model derives the parent directories from the paths. Keep absolute filesystem paths and permission checks in your own code.

The view virtualizes, so it needs a height to scroll in. Without `label` the tree is named "Files" (`tree.label`); give it a name that says which files it holds.

## Defaults and ownership

`useFileTree` starts with closed directories, directories before files in numeric order ([`FileTree.compareRows`](/ui/display/file-tree/models-loading#sorting-and-flattened-paths)), the [`FileIcon`](/ui/display/file-icon) set (`FILE_TREE_ICONS`), and the engine's search, sticky folders and context menu turned off. You can override any of these. Density and row height are fixed. `unsafeCSS` is appended to the wrapper's own styles inside the tree's shadow root.

The options only create the model. A new `paths` array or `initialExpansion` on a later render does not rebuild it; use the model's methods instead (`resetPaths`, `add`, `remove`, `move`, `batch`, `setGitStatus`, `setIcons`). Only `onSelectionChange` is kept current by the hook.

```tsx
import { useEffect } from 'react';
import { FileTree, useFileTree } from '@adecore/ui';

export function Files({ paths }: { paths: readonly string[] }) {
    const { model } = useFileTree({ paths });
    useEffect(() => {
        model.resetPaths(paths);
    }, [model, paths]);
    return <FileTree.Root model={model} label="Files" className="h-64" />;
}
```

`resetPaths` replaces the whole listing and its expansion; [Models, loading and expansion](/ui/display/file-tree/models-loading) shows how to keep folds, and how to apply smaller changes. Changing the model changes what is drawn, never the filesystem.

Your code owns filesystem changes, listings, search requests, caches and permissions; the model owns the displayed paths, selection and expansion. The hook cleans up its model when the component unmounts, so do not call `cleanUp()` on it while it is mounted. Unsubscribe your own model listeners and cancel your own requests when the root changes.

## Guides

- [Models, loading and expansion](/ui/display/file-tree/models-loading): sorting, flattened directories, changes, lazy listings, remembered folds and search.
- [Interaction and row controls](/ui/display/file-tree/interaction-controls): activation, selection, checkboxes, context menus, dragging and long names.
- [Reference](/ui/display/file-tree/reference): every option, prop and helper, and what to check before an engine update.

## Limits

The row controls sit in slots beside the engine's own row buttons, in its shadow root. Pointer and keyboard behavior there is tested; screen reader behavior across those slots is not verified yet. The wrapper relies on internals of the pinned engine version, so a dependency update needs the checks listed in the [reference](/ui/display/file-tree/reference#engine-updates).

The file tree's helper, style and shift modules carry the [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/ui/src/file-tree/LICENSE) license, marked in their SPDX headers; the rest of the package is MIT.
