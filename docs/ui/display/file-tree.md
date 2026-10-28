# FileTree

A tree of file paths, drawn in the library's theme on the `@pierre/trees` engine. `useFileTree` creates the model, and `FileTree.Root` draws it, with a sideways shift for names that do not fit.

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

Paths are POSIX and relative to a root you choose. A directory path ends in `/`; the model derives parent directories. Keep absolute paths and permission checks in your own code.

The view virtualizes, so it needs a height to scroll in. With `fitContent` it takes the height of its rows instead, up to its container's height; do not give it a height then. Without `label` the tree is named "Files" (`tree.label`); give it a name that says which files it holds.

## Defaults and ownership

`useFileTree` starts with closed directories, directories first in numeric order ([`FileTree.compareRows`](/ui/display/file-tree/models-loading#sorting-and-flattened-paths)), the [`FileIcon`](/ui/display/file-icon) set (`FILE_TREE_ICONS`), and the engine's search, sticky folders and context menu off. You can override each. Density and row height are fixed. `unsafeCSS` is appended to the wrapper's styles inside the shadow root.

The options only create the model. A new `paths` or `initialExpansion` on a later render does not rebuild it; use the model's methods (`resetPaths`, `add`, `remove`, `move`, `batch`, `setGitStatus`, `setIcons`).

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

`resetPaths` replaces the listing and its expansion; [Models, loading and expansion](/ui/display/file-tree/models-loading) shows how to keep folds. The model never touches the filesystem.

Your code owns filesystem changes, listings, search requests, caches and permissions. The model owns the displayed paths, selection and expansion. The hook cleans up its model on unmount, so never call `cleanUp()` yourself. Unsubscribe your own listeners and cancel your requests when the root changes.

## Guides

- [Models, loading and expansion](/ui/display/file-tree/models-loading): sorting, changes, lazy listings, empty directories, remembered folds and search.
- [Interaction and row controls](/ui/display/file-tree/interaction-controls): activation, selection, checkboxes, context menus, dragging and long names.
- [Reference](/ui/display/file-tree/reference): every option, prop and helper.

## Limits

Screen reader behavior across the row control slots is not verified yet. The wrapper relies on internals of the [pinned engine version](/ui/display/file-tree/reference#engine-updates).
