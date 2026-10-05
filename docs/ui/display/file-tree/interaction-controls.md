# Interaction and row controls

Selection, focus and activation are separate operations. A normal file click activates through `onActivate(path)`; Enter activates a focused file and toggles a directory once. Modifier selection stays with the engine.

## Focus and modifier keys

Unmodified arrows, Home and End move engine focus. With the default `selectionFollowsFocus=true`, the wrapper selects the resulting row after the engine handles the key. `onFocusMove` reports a changed focused path on that flow. It is not a general callback for every possible focus change. Set `selectionFollowsFocus={false}` when your host manages selection independently.

Shift, Control and Command selection gestures do not run normal file-click activation. `extendsSelection` recognizes those modifiers; `movesFocus` recognizes navigation without any modifier, including Alt. `selectOnly(model, path)` replaces selection, and `null` clears it. `focusRow(model, path)` focuses a mounted shadow row and returns `false` when that row is not mounted. Reveal and scroll to a path before depending on DOM focus.

## Viewed or staging controls

Use genuine checkbox state rather than a CSS marker or drawn checkbox. This complete component keeps viewed state in React; a staging host can replace the state callback with its authorized command adapter and aggregate directory state itself.

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

This directory decoration shows the total viewed count; it does not claim to count that directory's descendants. For an aggregate checkbox compute `checked` and `indeterminate` from your own descendant set, supply `disabled` while appropriate, and route `onCheckedChange` to the host. Loading and partial listings need an explicit aggregate policy.

`FileTree.Checkbox` shares [`Tree.Checkbox`](/ui/display/tree/reference#controls). Tab reaches enabled checkboxes and Space changes their state. Checking a box does not select, activate or collapse the row. Use `FileTree.Control` around another interactive control. Use `FileTree.Decoration` for trailing status content, and the [formatters](/ui/formatting/) for counts.

## Shadow slots and accessibility

beta.6 renders engine rows as buttons. The wrapper projects control and decoration content into sibling shadow slots outside those buttons, preserving React context and application styles. Event isolation prevents a checkbox click or key from becoming a row action. Do not replace this with a button nested inside an engine row or a style-based click detector.

Supply useful accessible names and actual mixed/disabled state. The light DOM controls have tested pointer and keyboard behavior, but screen-reader behavior across these shadow slots still needs verification in the consuming desktop runtime. The docs do not claim universal accessibility. Include the host's browser/desktop runtime and assistive technology in that verification.

## Context menus and dragging

`onRowContextMenu(path, targets, event)` receives a native `MouseEvent`. `onRowDragStart` receives a native `DragEvent` after the engine writes its drag data. `targets` is the complete selection if the triggering row belongs to a multi-selection, otherwise only that row. Call `event.preventDefault()` when taking over the context menu and open your host-owned menu at the event coordinates. The wrapper does not open it for you.

```tsx
import { FileTree, type FileTreeModel } from '@adecore/ui';

type MenuAdapter = (point: { x: number; y: number }, paths: readonly string[]) => void;

export function FileActions({ model, openMenu }: { model: FileTreeModel; openMenu: MenuAdapter }) {
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

`MenuAdapter` is host provided. Validate drag payloads and authorize filesystem changes in that host. Use engine `dragAndDrop` options for drop acceptance and completion; adding drag data alone does not implement a drop. Do not serialize credentials or absolute private paths into transferable drag data.

## Long names

A horizontal swipe or Shift-wheel shifts visible content until the longest visible name fits. The row width stays fixed and decorations stay pinned. Resize and visible-row changes recalculate the limit; the indicator uses whole pixels and honors reduced motion.

Set `resetKey` to a stable root identity. Changing it resets the shift, but does not replace paths, clear selection or cancel host requests. Combine it with the model and loader reset appropriate to a root change. End truncation and shift depend on the beta.6 shadow layout; retain those workarounds until an engine update has been checked.
