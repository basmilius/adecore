# Button

Every button with a word in it. A button that is only an icon is an [`IconButton`](/ui/actions/icon-button).

```tsx
import { Button } from '@adecore/ui';
```

## Variants

`ghost`, the default, is quiet and lifts on hover. `secondary` has a border and a raised ground. Use at most one `primary` per screen. `danger` is for an irreversible deletion, `danger-outline` for a step that forgets rather than destroys, and `positive` for a step that completes something, such as a merge. `inverse` is dark on light and light on dark, as many sign-in buttons require.

<Demo src="actions/button-variants" />

## Sizes and links

`md` is 32 pixels tall, `sm` 28 and `xs` 24. An icon before the word is a 14 pixel [`Icon`](/ui/display/icon). With `href` the button is an anchor that opens in a new tab.

<Demo src="actions/button-sizes" />

## Pill

`shape="pill"` is 36 pixels tall and fully rounded, for a row of round controls. It ignores `size`.

<Demo src="actions/button-pill" />

## Props

`Button` takes every prop of a `<button>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `variant` | `ButtonVariant` | `'ghost'` | `'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'danger-outline' \| 'positive' \| 'inverse'` |
| `size` | `ButtonSize` | `'md'` | `'xs' \| 'sm' \| 'md'` |
| `shape` | `ButtonShape` | `'default'` | `'default' \| 'pill'` |
| `href` | `string` | | Renders an anchor with `target="_blank"` and `rel="noreferrer"`. |
| `type` | `string` | `'button'` | Set `'submit'` inside a form. |
| `ref` | `Ref<HTMLButtonElement>` | | |

`ButtonProps`, `ButtonVariant`, `ButtonSize` and `ButtonShape` are exported types.

## Accessibility

`disabled` is the native attribute: the button leaves the tab order and fades. `Button` styles no `aria-disabled` state; an [`IconButton`](/ui/actions/icon-button) does.
