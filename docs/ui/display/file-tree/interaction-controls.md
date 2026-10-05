# Interaction and row controls

Focus, selection and activation are three things in a file tree. A plain click on a file calls `onActivate(path)`. Enter on a focused file does the same, and on a directory opens or closes it. Selection with a modifier stays with the engine.

## Focus and selection

The arrow keys, Home and End without a modifier move the engine's focus. With `selectionFollowsFocus` (on by default) the wrapper then selects the focused row, and calls `onFocusMove(path)` when the focus landed on another row. That is the only flow that calls it. Turn `selectionFollowsFocus` off when your code manages selection itself.

A click with Shift, Ctrl or Cmd extends the selection and does not activate. The helpers behind this are public: `FileTree.extendsSelection(event)` recognizes those modifiers, `FileTree.movesFocus(event)` a navigation key without any modifier, and `FileTree.followFocus(model, onMoved?)` selects the focused row once the engine has moved it, returning a function that cancels. `FileTree.selectOnly(model, path)` replaces the selection, and `null` clears it. `FileTree.focusRow(model, path)` focuses a row that is drawn and returns `false` when it is not, so scroll a path into view before you focus it.

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

The decoration here counts every viewed file, not the ones in that directory. A checkbox for a whole directory computes `checked` and `indeterminate` from your own set of descendants, and needs a rule for directories that are not fully loaded.

`FileTree.Checkbox` is [`Tree.Checkbox`](/ui/display/tree/reference#controls). Tab reaches it and Space toggles it, and checking it never selects, activates or folds the row. Wrap any other control in `FileTree.Control`, and put counts and status in `FileTree.Decoration`, written with the [formatters](/ui/formatting/).

## Slots

The engine draws each row as a button inside its shadow root. The wrapper puts the control and the decoration in slots beside that button, not inside it, so they keep your React context and your stylesheet. A click or a key in a slot never reaches the row. Do not nest a button of your own inside an engine row instead.

Give every control an accessible name and its real mixed and disabled state. Pointer and keyboard behavior in the slots is tested; how a screen reader reads them across the shadow boundary is not verified yet.

## Context menus and dragging

`onRowContextMenu(path, targets, event)` receives the native `MouseEvent`, and `onRowDragStart(path, targets, event)` the native `DragEvent`, after the engine wrote its own drag data. `targets` is the whole selection when the row is part of a selection of more than one, and otherwise the row alone (`FileTree.menuTargetsOf`). The wrapper opens no menu: call `event.preventDefault()` and open yours at the pointer.

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

`FileTree.rowPathOf(event)` finds the row path of an event inside the shadow root. Drag data alone is no drop: the engine's `dragAndDrop` option decides what a drop accepts and how it completes (`FileTreeDragAndDropConfig`, `FileTreeDropContext`, `FileTreeDropResult`). Check a dropped payload before you act on it, and keep credentials and private absolute paths out of drag data.

## Long names

A sideways swipe or Shift with the wheel shifts the names until the longest visible one fits. The rows keep their width and the decorations stay in place. A thin bar at the bottom shows the shift while it moves or while the pointer is near the bottom edge. A resize or other visible rows measure the limit again.

`resetKey` puts the shift back at zero when it changes; set it to something that names the root. It does nothing else: replacing paths, clearing the selection and cancelling requests stay yours.
