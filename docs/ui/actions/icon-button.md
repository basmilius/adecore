# IconButton

A button with an icon and no word. Its `label` is both the accessible name and the tooltip.

```tsx
import { IconButton } from '@adecore/ui';
```

<Demo src="actions/icon-button" />

## Sizes

The size sets the square, radius and icon: a 16 pixel icon in the default 32 pixel square, 14 in 28 (`sm`), and 12 in 24 (`xs`) and 20 (`2xs`). Never set a height, width or radius. To widen it for a word passed as `children`, use `w-auto`.

<Demo src="actions/icon-button-sizes" />

## State

`active` draws a pressed key, for a toggle that is on. For a real toggle, set `aria-pressed` instead; both look the same. `busy` replaces the icon with a [`Spinner`](/ui/display/spinner).

`iconClassName` goes to the icon or spinner: a rotating chevron, a status tone, `fill-current`. For an icon of another size, pass it as `children` without `icon`.

`disabled` blocks the pointer, so the tooltip never opens. `aria-disabled` looks the same but keeps focus and the tooltip, which can say why. It does not stop `onClick`.

## As another element

`render` merges the button into another element, such as a menu trigger:

```tsx
<Menu.Root>
    <IconButton icon={Ellipsis} label="More" render={<Menu.Trigger />} />
    <Menu.Popup>...</Menu.Popup>
</Menu.Root>
```

## Props

`IconButton` takes every prop of a `<button>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` | | Required. The accessible name, and the tooltip unless `tooltip` says otherwise. |
| `icon` | `LucideIcon` | | |
| `tooltip` | `ReactNode \| false` | `label` | A tooltip that says more than the name, or `false` for none. |
| `kbd` | `Shortcut \| string` | | Printed in the tooltip. A `Shortcut` also shows under the button while the modifier is held ([`ShortcutHints`](/ui/display/shortcut-hints)). |
| `tooltipSide` | `TooltipSide` | `'top'` | |
| `size` | `IconButtonSize` | `'md'` | `'md' \| 'sm' \| 'xs' \| '2xs'` |
| `active` | `boolean` | `false` | Draws a pressed key. |
| `busy` | `boolean` | `false` | A `Spinner` in place of the icon. |
| `iconClassName` | `string` | | Classes for the icon. |
| `children` | `ReactNode` | | Drawn after the icon: a count, or a word with `w-auto`. |
| `render` | `RenderProp` | `<button type="button" />` | Another element to be the button. |

`IconButtonProps` and `IconButtonSize` are exported types.
