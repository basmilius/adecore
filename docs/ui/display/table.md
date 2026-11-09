# Table

Rows of things with the same columns: hostnames, clients, projects to pick, usage per model. A compound component on a CSS grid with the roles of a table, so a cell holds any control and a column can leave when the table gets narrow. For the facts of one thing, use a [`KeyValueList`](/ui/display/key-value-list); for a list without columns, a [`ListRow`](/ui/display/list-row).

```tsx
import { Table } from '@adecore/ui';
```

<Demo src="display/table" />

```tsx
<Table.Root
    label="Hostnames"
    columns={[
        { width: 'minmax(0,2fr)' },
        { width: 'auto', align: 'end' }
    ]}
>
    <Table.Head>
        <Table.Column>Hostname</Table.Column>
        <Table.Column>Requests</Table.Column>
    </Table.Head>
    <Table.Row>
        <Table.Cell>shop.example.com</Table.Cell>
        <Table.Cell>1,204</Table.Cell>
    </Table.Row>
</Table.Root>
```

## Parts

| Part | What it is |
| --- | --- |
| `Table.Root` | The table. `label` is its accessible name and `columns` lays out the columns. |
| `Table.Head` | The row of column headers. |
| `Table.Column` | One header. `sort` and `onSort` make it a button that sorts. |
| `Table.Row` | One row. `selected` tints it in the accent, `muted` mutes its text, and `onClick` makes it a button; `focusable={false}` keeps that row out of the tab order. |
| `Table.Cell` | One cell. Its text ends in an ellipsis; `truncate={false}` wraps it. `mono` sets it in the monospace face, muted. |
| `Table.Group` | Rows under a `label` that spans every column. |
| `Table.Foot` | A row of totals under the body, behind a stronger line. |
| `Table.Empty` | The message of a table without rows, across every column. |
| `Table.Loading` | Rows of bars while the rows load. `rows` says how many. |

Every part but `Table.Root` and `Table.Loading` takes the props of its element, plus `render` to draw another one.

## Columns

Each entry of `columns` is one column: `width` is a grid track (`minmax(0,2fr)`, `auto`, `120px`), `align: 'end'` puts its content at the end in tabular figures, and `hideBelow` drops it while the table is narrower than a breakpoint: `sm` (24rem), `md` (28rem), `lg` (32rem), `xl` (36rem) or `2xl` (42rem). The table measures its own width, not the window's, so a table in a narrow dialog drops its columns too.

A header or a cell takes the alignment and the hiding of its column from its place in the row, so a row's cells are its direct children, one per column.

## Frame and density

The table is bare by default, to sit inside a card that already draws a border. `framed` gives it a border and rounded corners of its own. `density="compact"` makes the rows shorter and the text smaller, for a long list or a dialog.

## Rich content

A cell holds any content: two lines, a [`Pill`](/ui/actions/pill), a [`Switch`](/ui/inputs/switch), an [`IconButton`](/ui/actions/icon-button) that opens a [`Menu`](/ui/menus/menu). Only text truncates, so a control keeps its own size; a block of two lines adds `truncate` to its lines. `muted` on a row reads as a row a person cannot change.

<Demo src="display/table-rich" />

## Picking rows

A row with `onClick` is a tab stop that Enter and Space press, with a hover color. A click on a control inside the row, such as a checkbox, stays the control's. When that control does what the row's click does, `focusable={false}` keeps the row out of the tab order: the pointer still picks the whole row, and the keyboard reaches only the control. With `maxHeight` the body scrolls under a head that stays at the top.

<Demo src="display/table-selection" />

## Sorting and totals

`sort` is `none`, `asc` or `desc`, and the header carries `aria-sort`. A click calls `onSort` with the direction it asks for; the caller sorts the rows. `Table.Foot` holds the totals.

<Demo src="display/table-sortable" />

## Empty and loading

<Demo src="display/table-states" />

`TableRootProps`, `TableHeadProps`, `TableColumnProps`, `TableRowProps`, `TableCellProps`, `TableGroupProps`, `TableFootProps`, `TableEmptyProps`, `TableLoadingProps`, `TableColumnLayout`, `TableBreakpoint`, `TableSort` and `TableDensity` are exported types.
