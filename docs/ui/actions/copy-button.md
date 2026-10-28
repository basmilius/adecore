# CopyButton

A button that copies text and confirms it: the icon turns into a check and the button reads "Copied" for a moment. For a token, an id, a command.

```tsx
import { CopyButton } from '@adecore/ui';
```

<Demo src="actions/copy-button" />

By default it is an [`IconButton`](/ui/actions/icon-button). `label` is its accessible name and tooltip, `Copy` by default. While it confirms, only the tooltip changes to `Copied`.

```tsx
<CopyButton text={dsn} label="Copy DSN" size="xs" />
```

With `showLabel` it is a [`Button`](/ui/actions/button) with icon and word, and takes a `Button`'s `variant` and `size`.

```tsx
<CopyButton text={output} label="Copy output" showLabel size="sm" variant="secondary" />
```

It copies with [`copyText`](/ui/utilities/clipboard). If the browser refuses, nothing shows. Screen readers hear `Copied` through a status region.

In a menu, use a `Menu.Item` that calls `copyText` instead.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `text` | `string` | | Required. |
| `label` | `string` | `'Copy'` | |
| `showLabel` | `boolean` | `false` | |
| `size` | `IconButtonSize` or `ButtonSize` | `'md'` | |
| `variant` | `ButtonVariant` | `'ghost'` | With `showLabel`. |
| `tooltipSide` | `TooltipSide` | `'top'` | Without `showLabel`. |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | |

`CopyButtonProps` is an exported type.
