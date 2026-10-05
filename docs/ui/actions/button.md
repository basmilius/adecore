# Button

Every button with a word in it. A button that is only an icon is an [`IconButton`](/ui/actions/icon-button), which is a square rather than a label.

```tsx
import { Button } from '@adecore/ui';
```

## Variants

`ghost` is the default, a quiet button that lifts under the pointer. Give a screen one `primary` at most. `danger` is for a deletion that cannot come back, `danger-outline` for a step that forgets something rather than destroys it. `inverse` is dark on a light theme and light on a dark one, the way many sign-in buttons ask to be drawn.

<Demo src="actions/button-variants" />

## Sizes and links

`md` is 32 pixels tall, `sm` 28 and `xs` 24, which fits a header of 32. An icon inside a button is 14 pixels in `sm` and `md`. With `href` the button renders a real anchor that opens in a new tab, so it opens the way links open.

<Demo src="actions/button-sizes" />

## Props

`Button` takes every prop of a `<button>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `variant` | `ButtonVariant` | `'ghost'` | `'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'danger-outline' \| 'positive' \| 'inverse'` |
| `size` | `ButtonSize` | `'md'` | `'xs' \| 'sm' \| 'md'` |
| `href` | `string` | | Renders an anchor with `target="_blank"` and `rel="noreferrer"`. |
| `type` | `string` | `'button'` | Set `'submit'` explicitly inside a form. |
| `ref` | `Ref<HTMLButtonElement>` | | |

`ButtonProps`, `ButtonVariant` and `ButtonSize` are exported types.

## Accessibility

A disabled button uses the native `disabled` attribute, which also takes it out of the tab order. When a person should still be able to reach it and hear why it does nothing, keep it enabled with `aria-disabled` and explain in a [`Tooltip`](/ui/overlays/tooltip).
