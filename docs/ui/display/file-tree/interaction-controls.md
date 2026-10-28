# Interaction and row controls

Focus, selection and activation are three things in a file tree. A plain click on a file calls `onActivate(path)`. Enter on a focused file does the same, and on a directory opens or closes it. Selection with a modifier stays with the engine.

## Focus and selection

The arrow keys, Home and End without a modifier move the engine's focus. With `selectionFollowsFocus` (on by default) the wrapper selects the focused row and calls `onFocusMove(path)`; nothing else calls it. Turn it off when your code manages selection.

A click with Shift, Ctrl or Cmd extends the selection and does not activate. The helpers behind this are public; see the [reference](/ui/display/file-tree/reference#helpers). `FileTree.focusRow(model, path)` returns `false` for a row that is not drawn, so scroll a path into view first.

## Checkboxes and decorations

A row that can be checked carries a real checkbox, not a drawn mark. `renderControl` draws before the icon, `renderDecoration` after the name:

```tsx
import { useState } from 'react';
import { FileTree, useFileTree } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';

export function ReviewFiles() {
    const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());
    const { model } = useFileTree({
        paths: ['src/index.ts', 'src/helpers.ts', 'README.md'],
        initialExpansion: 'open'
    });
    return (
        <FileTree.Root
            model={model}
            label="Changed files"
            className="h-64"
            renderControl={(row) =>
                row.kind === 'file' ? (
                    <FileTree.Checkbox
                        label={`Mark ${row.path} as viewed`}
                        checked={viewed.has(row.path)}
                        onCheckedChange={(checked) =>
                            setViewed((current) => {
                                const next = new Set(current);
                                if (checked) {
                                    next.add(row.path);
                                } else {
                                    next.delete(row.path);
                                }
                                return next;
                            })
                        }
                    />
                ) : null
            }
            renderDecoration={(row) => (row.kind === 'directory' ? <FileTree.Decoration>{formatNumber(viewed.size)} viewed</FileTree.Decoration> : null)}
        />
    );
}
```

A checkbox for a whole directory computes `checked` and `indeterminate` from your own set of descendants, and needs a rule for directories that are not fully loaded.

`rowIcon` replaces a row's file icon or chevron with a Lucide icon, such as a repository icon on a checkout. Return `undefined` to keep the glyph. A directory with an icon still opens and folds as before.

```tsx
<FileTree.Root model={model} label="Changes" rowIcon={(row) => (repositories.has(row.path) ? FolderGit2 : undefined)} />
```

With git status, the engine draws a status column after the name, and the decoration sits before it. `decorationOrder="after-status"` puts the decoration after the column.

`FileTree.Checkbox` is [`Tree.Checkbox`](/ui/display/tree/reference#controls). Tab reaches it, Space toggles it, and it never selects, activates or folds the row. Wrap any other control in `FileTree.Control`, and put counts and status in `FileTree.Decoration`, written with the [formatters](/ui/formatting/).

## Slots

The wrapper puts the control and the decoration in slots beside the engine's row button, so they keep your React context and stylesheet. A click or key in a slot never reaches the row. Do not nest a button of your own inside an engine row.

Give every control an accessible name and its real mixed and disabled state. Screen reader behavior across the shadow boundary is not verified yet.

## Context menus and dragging

`onRowContextMenu(path, targets, event)` receives the native `MouseEvent`, and `onRowDragStart(path, targets, event)` the native `DragEvent`, after the engine wrote its drag data. `targets` is the selection when it holds the row and more, otherwise the row alone (`FileTree.menuTargetsOf`). The wrapper opens no menu: call `event.preventDefault()` and open yours at the pointer.

```tsx
import { FileTree, type FileTreeModel } from '@adecore/ui';

type OpenMenu = (point: { x: number; y: number }, paths: readonly string[]) => void;

export function FileActions({ model, openMenu }: { model: FileTreeModel; openMenu: OpenMenu }) {
    return (
        <FileTree.Root
            model={model}
            label="Files"
            onRowContextMenu={(_path, targets, event) => {
                event.preventDefault();
                openMenu({ x: event.clientX, y: event.clientY }, targets);
            }}
            onRowDragStart={(_path, targets, event) => {
                event.dataTransfer?.setData('application/x-example-paths', JSON.stringify(targets));
            }}
        />
    );
}
```

`FileTree.rowPathOf(event)` finds the row path of an event inside the shadow root. The engine's `dragAndDrop` option decides what a drop accepts and how it completes (`FileTreeDragAndDropConfig`, `FileTreeDropContext`, `FileTreeDropResult`). Check a dropped payload before you act on it, and keep credentials and private absolute paths out of drag data.

## Long names

A sideways swipe or Shift with the wheel shifts the names until the longest visible one fits. Rows keep their width and decorations stay in place. A thin bar at the bottom shows the shift.

`resetKey` puts the shift back at zero when it changes; set it to something that names the root. It does nothing else.
