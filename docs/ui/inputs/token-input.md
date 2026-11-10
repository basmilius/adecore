# TokenInput

A row of removable tokens followed by free text, such as the recipients of a message or the tags of a note. You hold both the tokens and the text.

```tsx
import { TokenInput } from '@adecore/ui';
```

<Demo src="inputs/token-input" />

Enter, a comma and a semicolon call `onCommit` with the text, and so does leaving the field. You decide what the text becomes, so the same field takes addresses and tags: parse it, add tokens and clear `value`. Empty text commits nothing.

Backspace in an empty field calls `onRemove` with the key of the last token. Each token has a remove button that does the same for its own token; `removeLabel` names it, or it reads "Remove" and the token's label.

`invalid` on the field marks the text; `invalid` on a token marks that token, such as an address that did not parse. `variant="bare"` drops the border, ground and focus outline, for a field inside a row that draws them, as with [`Input`](/ui/inputs/input).

Inside a [`Field`](/ui/inputs/field) the text field takes its `id`, `aria-describedby` and `aria-invalid` from it. Outside one, give it a `label`.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `tokens` | `readonly TokenInputToken[]` | | Required. `{ key, label, invalid? }` |
| `value` | `string` | | Required. The text after the last token. |
| `onValueChange` | `(value: string) => void` | | Required. |
| `onCommit` | `(value: string) => void` | | Required. |
| `onRemove` | `(key: string) => void` | | Required. |
| `label` | `string` | | The accessible name of the text field. |
| `removeLabel` | `(token: TokenInputToken) => string` | | |
| `invalid` | `boolean` | `false` | |
| `variant` | `'field' \| 'bare'` | `'field'` | |

The other props of an `<input>` go to the text field, `className` to the row. `TokenInputProps` and `TokenInputToken` are exported types.
