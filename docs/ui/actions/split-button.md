# SplitButton

A primary action with a chevron beside it that opens a menu of related actions, drawn as one control: commit, with commit and push behind the chevron.

```tsx
import { Menu, SplitButton } from '@adecore/ui';
```

<Demo src="actions/split-button" />

It draws as one button with a divider. The two halves are separate buttons: each takes focus, can be disabled and has its own hint. The children are the action half's content, as in a [`Button`](/ui/actions/button). `menu` holds the rows of the [`Menu`](/ui/overlays/menu) the chevron opens, under the whole control and end-aligned unless `menuAlign` says otherwise.

```tsx
<SplitButton
    variant="primary"
    size="sm"
    disabled={!ready}
    tooltip={reason}
    menuLabel="More ways to commit"
    menu={<Menu.Item onClick={commitAndPush}>Commit and push</Menu.Item>}
    onClick={commit}
>
    Commit
</SplitButton>
```

## Props

`SplitButton` takes every prop of a `<button>` for its action half, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `variant` | `ButtonVariant` | `'secondary'` | Both halves. |
| `size` | `ButtonSize` | `'md'` | Both halves; the chevron half is narrower. |
| `tooltip` | `ReactNode` | | The hint on the action half. |
| `menu` | `ReactNode` | | The rows of the menu. Required. |
| `menuLabel` | `string` | | The chevron's accessible name, and its hint unless `menuTooltip` is set. Required. |
| `menuTooltip` | `ReactNode` | | Another hint for the chevron, such as why it is disabled. |
| `menuDisabled` | `boolean` | `false` | |
| `menuAlign` | `'start' \| 'center' \| 'end'` | `'end'` | |
| `menuClassName` | `string` | | A width for the menu, such as `w-72`. |
| `className` | `string` | | On the box around both halves. |
| `ref` | `Ref<HTMLSpanElement>` | | On the box around both halves. |

`SplitButtonProps` is an exported type. There is no pill shape.

## Accessibility

The chevron is a menu trigger named by `menuLabel`. It opens on Enter, Space and the arrow keys, and gets focus back when the menu closes.
