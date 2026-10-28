# Timeline

The spans of a trace on one time axis: a folding tree of rows, a bar per span colored by its kind, moments such as errors on the axis, and the selected span's details under its row:

<Demo src="charts/trace-waterfall" />

```tsx
import { Timeline, type TimelineKind } from '@adecore/charts';

const KINDS: TimelineKind[] = [
    { id: 'db', label: 'Database' },
    { id: 'http', label: 'Network' },
    { id: 'code', label: 'Code' }
];

<Timeline.Root data={spans} kinds={KINDS} label="Spans of GET /api/orders/1842" value={selected} onValueChange={setSelected}>
    <Timeline.Legend />
    <Timeline.Axis heading="Span">
        {errors.map((error) => (
            <Timeline.Moment key={error.id} at={error.at} label={error.title} />
        ))}
    </Timeline.Axis>
    <Timeline.Rows
        label={(span: TraceSpan) => (
            <>
                <span className="shrink-0 text-xs text-text-muted">{span.op}</span>
                <span className="min-w-0 truncate font-mono text-code text-text">{span.label}</span>
            </>
        )}
        detail={(span: TraceSpan) => <SpanDetail span={span} />}
    />
</Timeline.Root>
```

A timeline is not a `Chart.Root`. Its rows are HTML, its height follows the rows, and it brings its own 16px side padding, so place it flush in a panel. Below 576px, a row's bar moves under its label.

## Spans

Each row of `data` is a `TimelineSpan`, with any extra fields of the app's own. The render props of `Timeline.Rows` return the app's type when their parameter names it.

| Field | Type | |
| --- | --- | --- |
| `id` | `string` | Required. |
| `parent` | `string \| null` | The parent span. Null, or an id not in `data`, makes it a root. |
| `label` | `string` | Required. The screen reader name, and the row text without a `label` render prop. |
| `start`, `duration` | `number` | Required. Milliseconds, on one clock shared by all spans and moments. |
| `kind` | `string` | The id of one of `kinds`. |
| `tone` | `ChartColor` | Overrides the kind's color, such as `'error'` for a failed span. |

Every span follows its parent, and siblings sort by start.

## Timeline.Root

The axis runs from the earliest start to the latest end, or to `end`, which cuts longer spans off. `kinds` lists `TimelineKind`s (`id`, `label`, `tone`). A kind without a tone takes the next chart color, and a span without a kind the accent.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `data` | `readonly Span[]` | | Required. |
| `label` | `string` | | Required. The tree name for a screen reader. |
| `kinds` | `readonly TimelineKind[]` | `[]` | |
| `value`, `defaultValue`, `onValueChange` | `string \| null` | `null` | The selected span, which shows its detail. Selecting it again clears it. |
| `expanded`, `defaultExpanded`, `onExpandedChange` | `readonly string[]` | every span with children | The open spans. |
| `format` | `(ms: number) => string` | `formatPreciseDuration` | Writes every duration (`0.4 ms`, `123 ms`, `1.42 s`). |
| `ticks` | `number` | `5` | The most steps on the axis. |
| `end` | `number` | the latest end | Where the axis ends, in milliseconds. |
| `className`, `ref` | | | On the outer box. |

`TimelineRootProps` are the props.

## Legend, axis and moments

`Timeline.Legend` writes each kind with its color and the total time of its spans, leaving out root spans.

`Timeline.Axis` writes `heading` over the labels and round ticks over the bars. `durationTicks(total, count)` returns the same ticks for an axis of the app's own.

`Timeline.Moment` goes inside the axis: a diamond at `at`, in the `error` tone by default, with a tooltip of its label and offset ("Payment status timed out at +394 ms"). Moments outside the spans stand at the axis ends.

`TimelineLegendProps`, `TimelineAxisProps` and `TimelineMomentProps` are the props.

## Timeline.Rows

A row per visible span: depth guides, a fold button, a swatch, the label, and the bar with its duration. A folded row shows how many children it hides.

| Prop | Type | |
| --- | --- | --- |
| `label` | `(span, row) => ReactNode` | The row content after the swatch; the span's `label` by default. `row` is a `TimelineRowState`: `depth`, `children`, `expanded` and the bar `color`. |
| `detail` | `(span) => ReactNode` | Shown under the selected row. A press inside it keeps the selection. |
| `className`, `ref` | | On the tree. |

`TimelineRowsProps` are the props.

## Keyboard and screen reader

The rows are a `tree` with one tab stop. Every row is a `treeitem` named by its label, kind, start and duration ("SELECT orders, Database, starts at +12 ms, takes 40 ms"). The selected row's detail is its description.

| Key | |
| --- | --- |
| Up, Down | The previous or the next row. |
| Home, End | The first or the last row. |
| Right | Opens a folded row, or moves into an open one. |
| Left | Folds an open row, or moves to the parent. |
| Enter, Space | Selects the row, or clears the selection on the selected one. |

Folding a row that holds the focus moves the focus to it. Each moment is its own tab stop and opens its tooltip on focus.
