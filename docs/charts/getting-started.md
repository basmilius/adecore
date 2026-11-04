# Getting started

## Install

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies:

```sh
bun add @adecore/charts @adecore/ui i18next react-i18next
```

`d3-scale` and `d3-shape` come with the package. Set up [`@adecore/ui`](/ui/guide/getting-started) first. The charts draw on its theme and write their numbers and dates with its formatters, so they follow the format source `UIProvider` hands over.

## Load the styles

The package ships no stylesheet of its own. Its parts use Tailwind classes on the tokens of the theme, so let Tailwind scan it next to `@adecore/ui`:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";
@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/charts/dist";
```

The `@source` paths are relative to the CSS file.

## Add the words

The words ("No data", "Show values") live in a `charts` namespace, in English and Dutch. Add them to the app's i18next:

```ts
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from '@adecore/charts';

for (const [language, words] of Object.entries(CHARTS_RESOURCES)) {
    i18n.addResourceBundle(language, CHARTS_NAMESPACE, words);
}
```

## Colors

A series takes a `tone`: a status tone of the theme (`accent`, `error`, `needsYou`, `idle`, `running`, `muted`) or `{ color }` with any CSS value, such as `{ color: 'var(--brand)' }`. The type is `ChartColor`; the status tones alone are a `ChartTone`.

Without a tone, the series take `--chart-1` to `--chart-6` in order. That palette lives in the [theme of `@adecore/ui`](/ui/guide/theme#chart-series), not in this package. `--chart-1` is the accent, so the first series follows the accent the app sets.

## A first chart

Tokens per day, input and output stacked:

<Demo src="charts/tokens-per-day" />

```tsx
import { createChart } from '@adecore/charts';
import { formatDay, formatTokens } from '@adecore/ui/format';

interface TokenDay {
    day: number;
    input: number;
    output: number;
}

const UsageChart = createChart<TokenDay>();

export function TokensPerDay({ days }: { days: TokenDay[] }) {
    return (
        <UsageChart.Root data={days} x="day" label="Tokens per day" height={220}>
            <UsageChart.Grid />
            <UsageChart.YAxis format={formatTokens} />
            <UsageChart.XAxis format={(day) => formatDay(day as number)} />
            <UsageChart.Bars stack>
                <UsageChart.Bar value="input" label="Input" />
                <UsageChart.Bar value="output" label="Output" />
            </UsageChart.Bars>
            <UsageChart.Tooltip total />
            <UsageChart.Legend />
        </UsageChart.Root>
    );
}
```

`Chart.Root` owns the data, the scales, the cursor and the keyboard. Each part inside it draws one layer, in the order of the children, so the grid goes first. `Chart.Tooltip`, `Chart.Legend` and `Chart.Table` take their own places whatever their order. The [reference](/charts/reference#parts) lists every part.

The width follows the container, and `height` is fixed. `label` is required. A screen reader reads it as the name of the chart, and the table shows it as its caption.

## Typed rows

JSX cannot check `value="input"` against the row type. `createChart<Row>()` returns `Chart` typed as a `TypedChart`, so `x`, `group` and `value` take only keys or accessors of `Row`. The plain `Chart` takes any key, and warns in development when the first row lacks it:

```tsx
import { Chart } from '@adecore/charts';

<Chart.Root data={days} x="day" label="Tokens per day">
    <Chart.Bar value="input" label="Input" />
</Chart.Root>
```

## Checklist

- `@adecore/ui` is set up, with `UIProvider` above the charts.
- Tailwind scans `@adecore/charts` next to `@adecore/ui`.
- The `charts` namespace is in the app's i18next.
- Every chart has a `label`.
- The parent gives the chart its width, and `height` sets its height.
