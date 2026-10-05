# KeyValueList

The facts of one thing as names and values side by side: the headers of a message, the details of a connection, the properties of a record. A compound component on a description list (`<dl>`). For a setting a person changes, use a [`SettingsRow`](/ui/settings/settings-section) instead.

```tsx
import { KeyValueList } from '@adecore/ui';
```

<Demo src="display/key-value-list" />

```tsx
<KeyValueList.Root>
    <KeyValueList.Item>
        <KeyValueList.Name>Tempo</KeyValueList.Name>
        <KeyValueList.Value>118 BPM</KeyValueList.Value>
    </KeyValueList.Item>
</KeyValueList.Root>
```

## Parts

| Part | What it is |
| --- | --- |
| `KeyValueList.Root` | The list, a `<dl>`. `divided` puts a hairline between rows. |
| `KeyValueList.Item` | One row, which holds a name and its value. |
| `KeyValueList.Name` | The name, a `<dt>`, in the faint text color. |
| `KeyValueList.Value` | The value, a `<dd>`. `mono` sets it in the monospace face. |

Every part takes the props of its element, plus `render` to draw another one.

## Alignment

The names take the width of the widest one, so every value starts on the same line. A long name stops at two fifths of the list and wraps there, so a list of message headers never squeezes its values into a sliver. A value wraps too, also in the middle of a long token or URL, instead of running out of its column.

## A long list

`divided` draws a hairline between rows and gives each a little air, for a list that runs to dozens of rows. Without it the rows sit close, which suits three or four facts in a card. `mono` on a value suits a header, an id or a path that a person reads back letter by letter.

<Demo src="display/key-value-list-divided" />

## Rich content

A name and a value take any content: an [`Icon`](/ui/display/icon) before a name, a status icon before a value, or a row of [`Pill`](/ui/actions/pill)s. An icon sits on the middle of the line of text beside it.

<Demo src="display/key-value-list-rich" />

## Copying

The interface around it cannot be selected, but a value can, so a person can copy a header or a token. The names stay out of the selection.

`KeyValueListRootProps`, `KeyValueListItemProps`, `KeyValueListNameProps` and `KeyValueListValueProps` are exported types.
