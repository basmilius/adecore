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

The names take the width of the widest one, so every value starts on the same line. A very long name wraps instead of squeezing the values. A value wraps too, also inside a long token or URL.

## A long list

`divided` draws a hairline between rows and spaces them out, for a long list. Without it the rows sit close, for a few facts in a card. `mono` suits a header, an id or a path.

<Demo src="display/key-value-list-divided" />

## Rich content

A name and a value take any content: an [`Icon`](/ui/display/icon), a status icon or a row of [`Pill`](/ui/actions/pill)s.

<Demo src="display/key-value-list-rich" />

## Copying

A person can select and copy a value. The names stay out of the selection.

`KeyValueListRootProps`, `KeyValueListItemProps`, `KeyValueListNameProps` and `KeyValueListValueProps` are exported types.
