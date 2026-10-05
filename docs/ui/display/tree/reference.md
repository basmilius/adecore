# Tree reference

The parts take state and own none. Turn your model into a list of visible nodes with a stable id, a depth, a position among siblings, selection and expansion, and draw that list with `Tree.Row`. There is no model hook for `Tree`, and no path or expansion helpers: those belong to a file model, which is what [`FileTree`](/ui/display/file-tree) is.

## Root and rows

`Tree.Root` is a `<div>` with `role="tree"`. It invents no name, so give it `aria-label` or `aria-labelledby`. `TreeRootProps` is a `<div>`'s props plus `render`.

`Tree.Row` is a `<div>` with `role="treeitem"`:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `level` | `number` | `1` | `aria-level` and the indentation. |
| `selected` | `boolean` | `false` | `aria-selected` and the selected look. |
| `joinedStart` | `boolean` | `false` | Squares the corners toward the row before. |
| `joinedEnd` | `boolean` | `false` | Squares the corners toward the row after. |
| `interactive` | `boolean` | `true` | The hover look. `false` removes only that: no handler, no `aria-disabled`. |

Every other prop of a `<div>` passes through: `tabIndex`, `aria-expanded`, `aria-setsize`, `aria-posinset` and your handlers. A row that cannot be selected passes `aria-selected={undefined}`. The first level is padded 4 pixels and each level after it 16 more. `TreeRowProps` is the type.

## Chevron and content

`Tree.Chevron` is a button with a 12 pixel chevron in a 16 pixel slot, named "Expand" or "Collapse" (`tree.expand`, `tree.collapse`). It takes `expanded` (required) and `onExpandedChange(expanded)`, and is `type="button"` with `tabIndex={-1}`, so the row stays the target of the keyboard. A click stops at the chevron, calls your `onClick`, then calls `onExpandedChange(!expanded)` unless your handler prevented the default. A double-click stops there too. It never selects or focuses the row; `aria-expanded` belongs on the row. `TreeChevronProps` is the type.

`Tree.ChevronSlot` is an `aria-hidden` `<span>`, `Tree.Label` a `<span>` cut off at the end, and `Tree.Decoration` a `<span>` at the end of the row with tabular figures. Their types are `TreeChevronSlotProps`, `TreeLabelProps` and `TreeDecorationProps`.

## Controls

`Tree.Control` is a `<span>` with `data-tree-control` that stops click, double-click, keydown and pointerdown at itself, then calls your handler. It adds no role or name; those belong on the control inside. `TreeControlProps` is the type.

`Tree.Checkbox` is a [`Checkbox`](/ui/inputs/checkbox) inside a `Tree.Control`, and takes its props: `checked`, `onCheckedChange` and `label` (required), `indeterminate`, `disabled`, `className` and `ref`. It takes no `render`. `TreeCheckboxProps` is the type.

```tsx
import { Tree } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';

type ReviewRowProps = {
    name: string;
    count: number;
    checked: boolean;
    mixed: boolean;
    pending: boolean;
    onCheckedChange: (checked: boolean) => void;
};

export function ReviewRow({ name, count, checked, mixed, pending, onCheckedChange }: ReviewRowProps) {
    return (
        <Tree.Row interactive={false} aria-selected={undefined}>
            <Tree.ChevronSlot />
            <Tree.Checkbox label={`Mark ${name} as reviewed`} checked={checked} indeterminate={mixed} disabled={pending} onCheckedChange={onCheckedChange} />
            <Tree.Label>{name}</Tree.Label>
            <Tree.Decoration>{formatNumber(count)}</Tree.Decoration>
        </Tree.Row>
    );
}
```

## Loading

`Tree.Chevron` only calls `onExpandedChange`; it starts and awaits nothing. Keep a branch that can open apart from the children it loaded, so it can stay open while a request runs or after one failed, and draw loading, error and retry rows from your own model. Cache per source, drop duplicate requests, ignore answers for a previous root, and never cache a failure as an empty listing.

Store expansion by the stable ids of your model, and keep the ids of open branches whose parents have not loaded yet.

## Menus and dragging

The parts install no context menu or drag handler. Add your own, or render a row through a [`ContextMenu.Trigger`](/ui/overlays/context-menu) with `render`, keeping the row's `role`, ref, state attributes and focus handlers. Pick the targets of a menu from the selection, and put the focus back when the menu closes. A drag needs its own payload, a rule for what a drop accepts, and a change your code completes before the model follows.

## Long names

`Tree.Label` cuts a long name off at the end. The sideways shift of a `FileTree` is not part of these parts; choose your own way to show a very long name, and keep the decorations in view.

## Accessibility

Your code names the root, keeps one usable tab stop, sets expansion and the position among siblings, and implements the keys. Roles and labels alone make no tree a screen reader can use. Test loading, closing a branch with the focus inside it, disabled controls and the focus after a menu.
