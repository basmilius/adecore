# Data

Compare values and records. Give numbers as numbers, never as text, so a renderer can align, format and chart them.

<Demo src="intelligent-ui/data" />

```ui
<Stats>
<Stat label="Cold start" value={1.42} previous={1.9} unit="s" tone="success" trend={[1.9, 1.84, 1.71, 1.52, 1.42]}/>
<Stat label="Bundle" value={812} unit="kB"/>
</Stats>
<EntityList>
<Entry label="Branch">main</Entry>
<Entry label="Runner">macOS arm64</Entry>
<Entry label="Took" as="duration">262000</Entry>
</EntityList>
<Table sort="size desc" rows={[{"file": "src/chat.ts", "size": 31877, "time": 830, "state": "passed"}, {"file": "src/app.ts", "size": 48213, "time": 1250, "state": "failed"}]}>
<Column key="file" title="File" as="file"/>
<Column key="size" title="Size" as="bytes"/>
<Column key="time" title="Build time" as="duration"/>
<Column key="state" title="State" as="tag" tones={{"passed": "success", "failed": "danger"}}/>
</Table>
<Chart kind="bar" unit="s" title="Seconds per day" data={[{"label": "Mon", "build": 41, "test": 63}, {"label": "Tue", "build": 38, "test": 59}, {"label": "Wed", "build": 44, "test": 71}]}/>
```

## Stats and Stat

A small set of key numbers. `Stats` has no props and holds only `Stat`. A `Stat` stands only inside `Stats` and has no children.

| Prop       | Type             | Required | Notes                                                                            |
| ---------- | ---------------- | -------- | -------------------------------------------------------------------------------- |
| `label`    | string           | Yes      |                                                                                  |
| `value`    | number or string | Yes      | A number, or a value in words that is shown as written and compares with nothing |
| `previous` | number           | No       | The value to compare with; the tile shows the change                             |
| `unit`     | string           | No       | Stands apart from the number, in smaller type; a percent sign stays attached     |
| `tone`     | `UiTone`         | No       | Colors the change and the trend; without it both stay neutral                    |
| `trend`    | array of numbers | No       | 2 to 64 numbers that say how the value moved, oldest first                       |

The change stands at the end of the value's line: an arrow and the percentage with its sign, or the previous value when that was zero. Its tooltip says what the value changed from. A value in words shows no unit and no change. A `trend` draws as a line under the value, on a scale of its own, and a screen reader hears its first and last number.

## Meter

A value against a limit, such as a context window or a coverage target. Its children are the label. Unlike [Progress](/intelligent-ui/components/status#progress), a Meter says nothing about work that runs.

| Prop     | Type     | Required | Notes                                                               |
| -------- | -------- | -------- | ------------------------------------------------------------------- |
| `value`  | number   | Yes      |                                                                     |
| `max`    | number   | No       | Above zero; 100 without it, and then only the value is written      |
| `mark`   | number   | No       | A line across the bar, such as a target                             |
| `unit`   | string   | No       | Written after the value and the max, a percent sign without a space |
| `tone`   | `UiTone` | No       | Colors the value and gives it the tone's icon                       |
| `detail` | string   | No       | A faint line under the bar                                          |

```ui
<Meter value={142} max={200} mark={160} unit="k" detail="Compacts at 160k">Context</Meter>
<Meter value={71} unit="%" mark={80} tone="warning" detail="Target 80%">Coverage</Meter>
```

A screen reader hears the label, the value against the max, the mark and the tone in words.

## Parts and Part

How a whole divides, as one bar. `Parts` holds only `Part`, one to six of them. A `Part` stands only inside `Parts`; its children are its label.

| Prop   | Type   | Required | Notes                                   |
| ------ | ------ | -------- | --------------------------------------- |
| `unit` | string | No       | Written after each value in its tooltip |

| Part prop | Type     | Required | Notes                                                   |
| --------- | -------- | -------- | ------------------------------------------------------- |
| `value`   | number   | Yes      | Zero or more                                            |
| `tone`    | `UiTone` | No       | The color of the part; the next chart color without one |

```ui
<Parts unit="tokens">
<Part value={6100000}>Large model</Part>
<Part value={2400000}>Small model</Part>
</Parts>
```

Each part is as wide as its share of the sum. The legend under the bar names every part with its share as a percentage, and a part's tooltip gives its value.

## EntityList and Entry

Labeled facts about one thing. `EntityList` holds only `Entry`. An `Entry` stands only inside `EntityList`; its children are the value.

| Prop     | Type   | Required | Notes                                                                        |
| -------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `layout` | string | No       | `tiles` or `list`; without it, tiles up to four entries and a list from five |

| Entry prop | Type   | Required | Notes                                                                   |
| ---------- | ------ | -------- | ----------------------------------------------------------------------- |
| `label`    | string | Yes      |                                                                         |
| `as`       | string | No       | What the value is, one of the kinds a [Column](#table-and-column) takes |

An Entry with `as` formats its value the way a table cell of that kind does, so `<Entry label="Took" as="duration">262000</Entry>` reads as a duration. A value the kind cannot read shows as written.

## Table and Column

Rows with named columns. `Table` holds only `Column`, which describes a field of the rows. Without Columns, the table shows the row keys.

| Prop   | Type             | Required | Notes                                                      |
| ------ | ---------------- | -------- | ---------------------------------------------------------- |
| `rows` | array of records | Yes      | At most 1,000 rows                                         |
| `sort` | string           | No       | A column key, with ` desc` behind it for the largest first |

| Column prop | Type   | Required | Notes                                                                     |
| ----------- | ------ | -------- | ------------------------------------------------------------------------- |
| `key`       | string | Yes      | The field of each row, 1 to 256 characters                                |
| `title`     | string | No       | The heading; the key without one                                          |
| `unit`      | string | No       | Written after each number                                                 |
| `as`        | string | No       | `text`, `number`, `bytes`, `duration`, `date`, `file`, `tag` or `percent` |
| `tones`     | record | No       | A `UiTone` per value of the column, such as `{"failed": "danger"}`        |

A `duration` is in milliseconds. A `percent` is the number before the sign, so `12.5` reads as 12.5%. A `date` is milliseconds since the epoch or an ISO string. A `file` is a path in mono text. A value of the wrong kind reads as text, and a missing one as nothing.

The table arrives in the order of `sort`; a key that is no column is ignored. A person sorts by any column from its heading, and a second press turns the order around. Numbers, bytes, durations, percentages and dates sort by value, and text by the reader's language. Empty cells come last in either direction. Every heading says its order to a screen reader with `aria-sort`.

`tones` colors the tags of an `as="tag"` column by their text. A text it does not name stays gray.

## Chart

Labeled numeric series. Each row of `data` has a `label` and up to six numeric series by name. Chart has no children.

| Prop    | Type             | Required | Notes                                                      |
| ------- | ---------------- | -------- | ---------------------------------------------------------- |
| `kind`  | string           | Yes      | `bar`, `hbar` (horizontal), `stacked`, `line` or `area`    |
| `data`  | array of records | Yes      | At most 1,000 rows of scalars                              |
| `unit`  | string           | No       | Written after each value                                   |
| `title` | string           | No       | What the chart shows                                       |
| `tones` | record           | No       | A `UiTone` per series name, such as `{"failed": "danger"}` |

`title` stands above the chart. A series named in `tones` wears that tone in place of its palette color, and the legend shows the tone's icon beside its name.

An `area` is a line with the space down to zero filled. A value that is not a finite number is a gap. A chart without a usable series, or with numbers it cannot scale, draws as its data.

Bars and `hbar` grow from zero in either direction, so negative values work. Stacked data with a negative value draws as side-by-side bars, with a note. A drawing holds the first 60 rows and six series and names what it leaves out, with every value a press away. More than six series get `too_many_series`. The chart truncates labels that do not fit.

```ui
$weeks = [{"label": "W1", "opened": 12, "closed": 9}, {"label": "W2", "opened": 8, "closed": 14}]
<Chart kind="stacked" title="Issues per week" tones={{"closed": "success"}} data={$weeks}/>
```
