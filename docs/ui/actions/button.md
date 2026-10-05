# Button

Every button with a word in it. A button that is only an icon is an [`IconButton`](/ui/actions/icon-button).

```tsx
import { Button } from '@adecore/ui';
```

## Variants

`ghost` is the default, a quiet button that lifts under the pointer. `secondary` has a border and a raised ground. Give a screen one `primary` at most. `danger` is for a deletion that cannot come back, `danger-outline` for a step that forgets something rather than destroys it, and `positive` for a step that completes something, such as a merge. `inverse` is dark on a light theme and light on a dark one, the way many sign-in buttons ask to be drawn.

<Demo src="actions/button-variants" />

## Sizes and links

`md` is 32 pixels tall, `sm` 28 and `xs` 24, which fits a header of 32. An icon before the word is a 14 pixel [`Icon`](/ui/display/icon). With `href` the button is an anchor that opens in a new tab.

<Demo src="actions/button-sizes" />

## Props

`Button` takes every prop of a `<button>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `variant` | `ButtonVariant` | `'ghost'` | `'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'danger-outline' \| 'positive' \| 'inverse'` |
| `size` | `ButtonSize` | `'md'` | `'xs' \| 'sm' \| 'md'` |
| `href` | `string` | | Renders an anchor with `target="_blank"` and `rel="noreferrer"`. |
| `type` | `string` | `'button'` | Set `'submit'` inside a form. |
| `ref` | `Ref<HTMLButtonElement>` | | |

`ButtonProps`, `ButtonVariant` and `ButtonSize` are exported types.

## Accessibility

`disabled` is the native attribute. The button leaves the tab order, takes no pointer events and fades to half its opacity. `Button` styles no `aria-disabled` state; an [`IconButton`](/ui/actions/icon-button) does.
