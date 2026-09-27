# IconButton

A button that is an icon and no word. It is a square, and the one place the icon inside it gets its size. Its `label` is the accessible name and the tooltip at once, so the two never drift apart.

```tsx
import { IconButton } from '@basmilius/react-ui';
```

<Demo src="actions/icon-button" />

## Sizes

The size decides the square, the radius and the icon inside: 16 in the default 32, 14 in 28 (`sm`), and 12 in 24 (`xs`) and 20 (`2xs`). Never set a height, a width or a radius on it. `w-auto` is the one way to widen it, for a word beside the icon handed in as children.

<Demo src="actions/icon-button-sizes" />

## Toggles and state

`active` draws the button as a pressed key, for a toggle that is on. Where the button is a real toggle, use `aria-pressed` instead, as the bold and italic buttons above do. The theme draws both the same. `spin` turns the icon for a step that is running.

A disabled icon button with `disabled` loses its tooltip, because a disabled button takes no pointer events. With `aria-disabled` it keeps its focus and its tooltip, which can say why nothing happens.

## As another element

`render` makes another element the button, such as a menu trigger. The trigger's behavior and the button's look merge into one element:

```tsx
<Menu.Root>
    <IconButton icon={Ellipsis} label="More" render={<Menu.Trigger />} />
    <Menu.Popup>...</Menu.Popup>
</Menu.Root>
```

## Props

`IconButton` takes every prop of a `<button>` except `children`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` | | Required. The accessible name, and the tooltip unless `tooltip` says otherwise. |
| `icon` | `LucideIcon` | | Left out for a button that draws something else, handed in as `children`. |
| `tooltip` | `ReactNode \| false` | `label` | A tooltip that says more than the name, or `false` for none. |
| `kbd` | `Shortcut \| string` | | The shortcut printed in the tooltip, and under the button while the modifier is held. |
| `tooltipSide` | `TooltipSide` | `'top'` | |
| `size` | `IconButtonSize` | `'md'` | `'md' \| 'sm' \| 'xs' \| '2xs'` |
| `active` | `boolean` | `false` | Draws a pressed key. |
| `spin` | `boolean` | `false` | Turns the icon. |
| `children` | `ReactNode` | | Drawn after the icon: a count, or a word with `w-auto`. |
| `render` | `RenderProp` | `<button type="button" />` | Another element to be the button. |

`IconButtonProps` and `IconButtonSize` are exported types.
