# Getting started with FileTree

`useFileTree` owns a path-based model; `FileTree.Root` mounts its view. Use [`Tree`](/ui/display/tree) for nodes with domain identities such as connection ids or database objects.

First follow [UI setup](/ui/guide/getting-started): import `@adecore/ui/theme.css`, include package sources in your Tailwind scan, and mount [`UIProvider`](/ui/utilities/ui-provider) with your initialized i18next instance. The tree's fallback name and chevron labels use the `ui` namespace. An explicit label should describe this particular tree.

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

Paths are POSIX and relative to the chosen root. Canonical directory paths end in `/`; files do not. The model derives parent directories from the paths. Keep absolute filesystem paths and authorization in your host adapter.

The view needs a constrained height to scroll and virtualize. The wrapper fixes compact density, 25px rows and 12px chevrons. Passing different sizing is not part of `FileTreeOptions`.

## Defaults and ownership

The hook defaults to closed directories, directory-first numeric sorting, `FILE_TREE_ICONS`, disabled search, disabled sticky folders and disabled engine context-menu composition. You can override those options except density and row height. `unsafeCSS` appends to the wrapper's engine styles.

Options initialize the model once. A new `paths` array or `initialExpansion` prop on a later render does not rebuild it. Use `resetPaths`, `setGitStatus`, `setIcons` and other model methods for later changes. The wrapper keeps `onSelectionChange` current, and view callbacks and slot renderers read current props.

The underlying hook schedules model cleanup on unmount. Do not call `cleanUp()` on a hook-owned model while it is mounted. Unsubscribe your own model subscriptions and cancel your own listing/search requests when the root changes or the view unmounts. The wrapper disposes its native event listeners, expansion subscription and delayed focus callback itself.

## Updating paths

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

This deliberately resets the whole listing. Preserve expansion with the [model guide](/ui/display/file-tree/models-loading#persisting-expansion), or use `add`, `remove`, `move` and `batch` for smaller changes. Mutating the model changes the displayed paths, not the filesystem.
