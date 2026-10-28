# RelativeTime

A moment as its age, `5m ago`, with the exact date and time in a tooltip. For the right edge of a row: when a run finished, when a release was last seen, when a token was used.

```tsx
import { RelativeTime } from '@adecore/ui';
```

<Demo src="display/relative-time" />

The age is `formatAge` and the tooltip is `formatDayClockWithYear`, from [the date formatters](/ui/formatting/dates). Past a week the age turns into the date.

```tsx
<RelativeTime at={run.finishedAt} className="text-xs text-text-faint tabular-nums" />
```

It keeps its age current while on screen. It is a `<time>` with the moment in `dateTime`, and a tab stop so the tooltip opens on keyboard focus. `null`, `undefined` or an invalid date draws a dash with no tooltip and no tab stop.

Inside a row that takes focus itself, such as a menu item, pass `tooltip={false}` and put the exact time in the row's own tooltip or description.

```tsx
<RelativeTime at={session.updatedAt} tooltip={false} />
```

Set size and color through `className`. For an age inside a sentence ("ended 5m ago"), use `formatAgo` or `formatAge`.

## Props

| Prop          | Type                                  | Default |                                                     |
| ------------- | ------------------------------------- | ------- | --------------------------------------------------- |
| `at`          | `Date \| number \| null \| undefined` |         | Required. A number is milliseconds since the epoch. |
| `tooltip`     | `boolean`                             | `true`  | `false` drops the tooltip and the tab stop.         |
| `tooltipSide` | `TooltipSide`                         | `'top'` |                                                     |
| `className`   | `string`                              |         |                                                     |
| `ref`         | `Ref<HTMLElement>`                    |         | The `<time>`, or the `<span>` of the dash.          |

`RelativeTimeProps` is an exported type.
