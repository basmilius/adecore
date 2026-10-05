# Tree part reference

Import the `Tree` namespace and its prop types from `@adecore/ui`. There is no model hook for generic Tree rows.

## Root and rows

`Tree.Root` renders a `div` with `role="tree"`. `TreeRootProps` includes ordinary div props and Base UI's `render`. Supply `aria-label` or `aria-labelledby`; Root does not invent a name.

| `Tree.Row` prop         | Default | Meaning                                                                            |
| ----------------------- | ------- | ---------------------------------------------------------------------------------- |
| `level?: number`        | `1`     | `aria-level` and indentation. Use valid positive levels.                           |
| `selected?: boolean`    | `false` | `aria-selected` and selected appearance.                                           |
| `joinedStart?: boolean` | `false` | Join selection styling to the preceding row.                                       |
| `joinedEnd?: boolean`   | `false` | Join selection styling to the following row.                                       |
| `interactive?: boolean` | `true`  | Interactive appearance only.                                                       |
| Native div props        |         | Host event handlers, `tabIndex`, `aria-expanded`, `aria-setsize`, `aria-posinset`. |

`TreeRowProps` renders a `div` with `role="treeitem"`. A nonselectable row can pass `aria-selected={undefined}`. The host owns focus, activation, range selection and loading. Row does not handle keys or make itself a tab stop. `className`, `ref`, `style` and `render` compose with its element props.

Rows are 25px tall. The first level starts at 4px inline padding; each further level adds 16px. Guides and selected corners share FileTree's internal row style. These are appearance defaults, not a data contract.

## Chevron and content

`Tree.Chevron` renders a button with a 12px icon in a 16px slot. `TreeChevronProps` requires `expanded: boolean` and optionally accepts `onExpandedChange(expanded)`. Its accessible label comes from translated Expand/Collapse words. It defaults to `type="button"` and `tabIndex={-1}` so the host row remains the navigation target.

A click stops propagation, calls your `onClick`, then calls `onExpandedChange(!expanded)` unless default was prevented. A double-click also stops propagation and calls your double-click handler. It does not select or focus the row. Its usual root state belongs on the row's `aria-expanded`, not on a leaf.

`Tree.ChevronSlot` renders an aria-hidden span for leaf alignment. `Tree.Label` renders a span with end truncation. `Tree.Decoration` renders a trailing span group. Their types are `TreeChevronSlotProps`, `TreeLabelProps` and `TreeDecorationProps`.

## Controls

`Tree.Control` renders a span with `data-tree-control`. `TreeControlProps` stops click, double-click, keydown and pointerdown propagation, then invokes the supplied handler. It does not assign a role or accessible name to arbitrary content. Supply that on the actual control.

`Tree.Checkbox` wraps the UI checkbox in `Tree.Control`. `TreeCheckboxProps` is the same as `CheckboxProps`:

| Prop                       | Required/default | Meaning                                      |
| -------------------------- | ---------------- | -------------------------------------------- |
| `checked: boolean`         | Required         | Controlled checkbox value.                   |
| `onCheckedChange(checked)` | Required         | Update host value or dispatch a host action. |
| `label: string`            | Required         | Accessible name.                             |
| `indeterminate?: boolean`  | `false`          | Mixed aggregate state.                       |
| `disabled?: boolean`       | Optional         | Disable the checkbox.                        |
| `className`, `ref`         | Optional         | Checkbox styling and button element ref.     |

The checkbox accepts this explicit prop set; it does not accept the generic `render` prop offered by element parts. Tab and Space use actual checkbox semantics. `FileTree.Checkbox`, `FileTree.Control` and `FileTree.Decoration` reuse these parts, with the file wrapper projecting them into shadow slots.

## Integration checks

Verify one row tab stop, arrow/Home/End behavior, collapse with focused descendants, selection announcement, mixed/disabled checkbox states, and context-menu focus restoration. Generic Tree uses ordinary DOM; FileTree adds an engine shadow boundary with its own pending desktop screen-reader verification. Neither package promises that a host's unimplemented keyboard or loading policy becomes accessible by styling alone.
