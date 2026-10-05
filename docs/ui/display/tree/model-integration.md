# Integrating a custom model

Tree parts accept state; they do not own it. Adapt your existing model to a visible sequence of nodes with stable ids, depth, sibling position, selection and expansion. Render that sequence with `Tree.Row` and keep the model's lifecycle in the host.

## Loading and persistence

Separate an expandable node from its loaded children. A branch can remain expandable while a request is pending or fails; show loading/error/retry nodes with your own model rules. `Tree.Chevron` only calls `onExpandedChange`. It does not initiate or await loading.

Keep caches per source identity and deduplicate pending requests. Cancel or ignore responses for a previous root/project, unsubscribe model listeners on unmount, and invalidate loaded branches when the host reports a domain change. A failed request should leave a retry path. Avoid caching failure as an empty successful listing.

Persist expansion with stable model ids, under the host's existing storage namespace. Retain expanded ids whose parents have not loaded. A theme/package change should not rename stored ids or reset the user's selection. Unlike `FileTree`, `Tree` has no path normalization or expansion helpers; those assumptions belong in a file model, not in a database or object graph.

## Controls and decorations

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

The host supplies aggregate state and an authorized command callback. `interactive={false}` disables interactive row styling; it does not remove event handlers, set `aria-disabled` or disable a checkbox. Pass the actual control state. The example is a nonselectable review row, so it omits `aria-selected`.

Wrap other interactive controls in `Tree.Control`. It stops click, double-click, keydown and pointerdown propagation before invoking your handler. Keep controls in a `div` row, and give each one an accessible name and appropriate tab behavior.

## Context menus and dragging

Tree parts do not install context-menu or drag handlers. Use native/React handlers from the host model, or compose a [`ContextMenu.Trigger`](/ui/overlays/context-menu) using Base UI's `render` prop to render the row directly. Preserve `role`, ref, state attributes and focus handlers when changing the rendered element.

Choose menu targets from model selection, keep actions consistent with read-only/permission state, and restore focus when the menu closes. Dragging needs an explicit payload, acceptance rules and a successful host mutation before the visible model is reconciled. CSS does not provide any of those behaviors.

## DatabaseExplorer

[`DatabaseExplorer`](/database/views/explorer) is a complete domain integration of `Tree` parts. Its model loads schemas, tables and columns as branches open, keeps one keyboard tab stop, handles retry rows, and persists expansion through provider storage. Its selection is `ExplorerSelection`; opening a table goes through `DatabaseProvider.onAction`, not a `Tree` callback.

Use that component when your nodes are database connections. Supply [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), its transport and action adapter. Do not rebuild its cache or backend operations merely to use the shared row appearance. A custom explorer can borrow the same split: host model and commands outside, Tree parts inside the renderer.

## Accessibility and long names

The host must name the root, maintain a usable roving tab stop, set expansion and sibling metadata, and implement its chosen keyboard policy. Row roles and labels alone do not verify a full tree with a screen reader. Test loading, collapse, disabled controls and menu focus in the consuming desktop runtime.

`Tree.Label` truncates; generic Tree parts do not install FileTree's horizontal-shift behavior or reset/resize observers. Choose a host scrolling policy for exceptionally long names, while keeping decorations visible. Do not attach file-model shift helpers to unrelated models.
