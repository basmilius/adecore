# StatStrip

The headline figures of a screen in one bordered strip, split by hairlines. Each figure has a label above it and an optional note under it.

```tsx
import { StatStrip } from '@adecore/ui';
```

<Demo src="display/stat-strip" />

```tsx
<StatStrip.Root>
    <StatStrip.Item label="Open issues" value={formatNumber(open)} note="Each counted once" />
    <StatStrip.Item label="Sessions" value={formatNumber(sessions)} />
</StatStrip.Root>
```

## Parts

| Part | What it is |
| --- | --- |
| `StatStrip.Root` | The strip, a `<dl>`. `ground` is `raised` (the default) or `surface`, as on a [`Card`](/ui/layout/card). |
| `StatStrip.Item` | One figure. `label` and `value` are required, `note` is a line under the value. |

Both parts take the props of their element, plus `render`.

Every figure is at least 144 pixels wide and the figures share the rest. In a narrow strip they wrap onto more rows, and the hairlines follow: a line between figures side by side, and one between rows. Format the values with [the formatters](/ui/formatting/), since the strip prints what it is given.

`StatStripRootProps` and `StatStripItemProps` are exported types.
