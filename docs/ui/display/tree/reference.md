# Tree reference

The parts take state and own none. Turn your model into a list of visible nodes with a stable id, a depth, a position among siblings, selection and expansion, and draw that list with `Tree.Row`. There is no model hook and there are no path helpers; for files, use [`FileTree`](/ui/display/file-tree).

## Root and rows

`Tree.Root` is a `<div>` with `role="tree"`. Give it `aria-label` or `aria-labelledby`. `TreeRootProps` is a `<div>`'s props plus `render` and `overflow` (`'truncate'` by default, or `'scroll'`).

`Tree.Row` is a `<div>` with `role="treeitem"`:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `level` | `number` | `1` | `aria-level` and the indentation. |
| `selected` | `boolean` | `false` | `aria-selected` and the selected look. |
| `joinedStart` | `boolean` | `false` | Squares the corners toward the row before. |
| `joinedEnd` | `boolean` | `false` | Squares the corners toward the row after. |
| `interactive` | `boolean` | `true` | The hover look. `false` removes only that: no handler, no `aria-disabled`. |

Every other prop of a `<div>` passes through: `tabIndex`, `aria-expanded`, `aria-setsize`, `aria-posinset` and your handlers. A row that cannot be selected passes `aria-selected={undefined}`. `TreeRowProps` is the type.

## Chevron and content

`Tree.Chevron` is a button named "Expand" or "Collapse" (`tree.expand`, `tree.collapse`). It takes `expanded` (required) and `onExpandedChange(expanded)`. It has `tabIndex={-1}`, so the row keeps the keyboard. A click calls your `onClick`, then `onExpandedChange(!expanded)` unless you prevented the default. Clicks never reach the row, so it never selects or focuses it. `aria-expanded` belongs on the row. `TreeChevronProps` is the type.

`Tree.ChevronSlot` is an `aria-hidden` `<span>`, `Tree.Label` a `<span>` cut off at the end, and `Tree.Decoration` a `<span>` at the end of the row with tabular figures. Their types are `TreeChevronSlotProps`, `TreeLabelProps` and `TreeDecorationProps`.

## Controls

`Tree.Control` is a `<span>` that keeps click, double-click, keydown and pointerdown from reaching the row, then calls your handler. It adds no role or name; those belong on the control inside. `TreeControlProps` is the type.

`Tree.Checkbox` takes `checked`, `onCheckedChange` and `label` (required), `indeterminate`, `disabled`, `className` and `ref`, but no `render`. `TreeCheckboxProps` is the type.

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

`Tree.Chevron` starts and awaits nothing. Keep whether a branch is open apart from whether its children loaded, so it can stay open while a request runs or after one failed. Draw loading, error and retry rows from your own model. Never cache a failure as an empty listing.

Store expansion by stable ids, including open branches whose parents have not loaded yet.

## Menus and dragging

The parts install no context menu or drag handler. Add your own, or render a row through a [`ContextMenu.Trigger`](/ui/overlays/context-menu) with `render`, keeping the row's `role`, ref, state attributes and focus handlers. Put the focus back when the menu closes.

## Long names

`Tree.Label` cuts a long name off at the end. `overflow="scroll"` on `Tree.Root` shifts the rows sideways instead; see [rows wider than the tree](/ui/display/tree#rows-wider-than-the-tree).

## Accessibility

Your code names the root, keeps one tab stop, sets expansion and the position among siblings, and implements the keys. Test loading, closing a branch with the focus inside it, disabled controls and the focus after a menu.
