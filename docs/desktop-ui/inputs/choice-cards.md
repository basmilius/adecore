# ChoiceCards

One of a few options, each a card that says what it means. Use it for a choice that deserves more than a select, where the description is what helps a person decide.

```tsx
import { ChoiceCards } from '@basmilius/desktop-ui';
```

<Demo src="inputs/choice-cards" />

## Vertical, with a detail

Choices with long descriptions stand one under the other with `orientation="vertical"`. A vertical group can show a `detail` right under the checked card, for what that choice still asks for, such as a folder or an address. `radio="start"` moves the dot before the title.

<Demo src="inputs/choice-cards-vertical" />

## Columns

More choices than one row has room for fill a set number of columns with `columns`, row by row. It takes the place of `orientation`, so a group with columns shows no `detail`.

<Demo src="inputs/choice-cards-columns" />

## Keyboard

The cards are a Base UI radio group. Tab moves into the group and onto the checked card, and the arrow keys move between cards and check them.

## Props

`ChoiceCards` is generic over the value, a string or a number.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `Value` | | Required. |
| `onValueChange` | `(value: Value) => void` | | Required. |
| `choices` | `readonly Choice<Value>[]` | | Required. |
| `label` | `string` | | Required. The group has no visible heading of its own. |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | |
| `columns` | `number` | | Replaces `orientation`. |
| `radio` | `'start' \| 'end'` | `'end'` | |
| `detail` | `ReactNode` | | Vertical groups without `columns` only. |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

A `Choice<Value>` is `{ value, title, description, icon?, disabled? }`. `ChoiceCardsProps` and `Choice` are exported types.
