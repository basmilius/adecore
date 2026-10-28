# ChoiceCards

One of a few options, each a card with a description, for a choice where the description helps decide.

```tsx
import { ChoiceCards } from '@adecore/ui';
```

<Demo src="inputs/choice-cards" />

## Vertical, with a detail

`orientation="vertical"` stacks the cards, for long descriptions. A vertical group can show a `detail` under the checked card, for what that choice still needs, such as a folder. `radio="start"` moves the dot before the title.

<Demo src="inputs/choice-cards-vertical" />

## Columns

`columns` lays the cards out in that many columns. It replaces `orientation` and shows no `detail`.

<Demo src="inputs/choice-cards-columns" />

## Keyboard

The cards are a Base UI radio group. Tab lands on the checked card, and the arrow keys move and check.

## Props

`ChoiceCards` is generic over the value, a string or a number.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `Value` | | Required. |
| `onValueChange` | `(value: Value) => void` | | Required. |
| `choices` | `readonly Choice<Value>[]` | | Required. |
| `label` | `string` | | Required. The group's accessible name. |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | |
| `columns` | `number` | | Replaces `orientation`. |
| `radio` | `'start' \| 'end'` | `'end'` | |
| `detail` | `ReactNode` | | Vertical groups without `columns` only. |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

A `Choice<Value>` is `{ value, title, description, icon?, disabled? }`. `ChoiceCardsProps` and `Choice` are exported types.
