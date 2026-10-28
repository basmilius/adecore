# DataGrid

The grid of [`TableView`](/database/views/table-view) and [`QueryConsole`](/database/views/query-console), for the app's own rows, such as the lines of a CSV file. It needs no connection or [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), only the `UIProvider` of `@adecore/ui` and the package's [Tailwind source](/database/guide/getting-started#tailwind).

```tsx
import { DataGrid, type GridColumn, type GridRow } from '@adecore/database';
```

```tsx
const columns: GridColumn[] = [
    { name: 'city', type: '', kind: 'text' },
    { name: 'population', type: '', kind: 'integer' }
];

const rows: GridRow[] = [
    { key: '0', number: 1, cells: ['Utrecht', '374238'] },
    { key: '1', number: 2, cells: ['Zwolle', ''] }
];

<DataGrid label="cities.csv" columns={columns} rows={rows} className="h-full" />;
```

A column aligns by its `kind`: `'text'` to the start, `'integer'`, `'decimal'` and `'float'` to the end. `type` is the type name in the header's tooltip, or empty. A row's `key` must stay stable, since the selection follows it, and `number` is the gutter number. `cells` holds one value per column. `null` draws as a faint `NULL`; an empty text is `''`.

Without `editable` no cell can be edited. A person can still select and copy cells as TSV, CSV or JSON, and resize, hide and pin columns.

## Sorting

The grid draws `rows` in the given order. With `onSortsChange`, a header's menu offers Sort ascending, Sort descending and Clear sorting, and reports the sorts by column name. Sort the rows yourself and pass the sorts back as `sorts` to draw the header arrows:

```tsx
const [sorts, setSorts] = useState<readonly GridSort[]>([]);
const sorted = useMemo(() => sortRows(rows, sorts), [rows, sorts]);

<DataGrid label="cities.csv" columns={columns} rows={sorted} sorts={sorts} onSortsChange={setSorts} />;
```

## Props

| Prop                  | Type                                       | Default |                                                                                       |
| --------------------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------- |
| `columns`             | `readonly GridColumn[]`                    |         | Required.                                                                             |
| `rows`                | `readonly GridRow[]`                       |         | Required. Drawn in this order.                                                        |
| `label`               | `string`                                   |         | Required. The accessible name of the grid.                                            |
| `sorts`               | `readonly GridSort[]`                      |         | The sorted columns by name, in order.                                                 |
| `onSortsChange`       | `(sorts: readonly GridSort[]) => void`     |         | Makes the headers sort.                                                               |
| `onFocusedCellChange` | `(cell: FocusedCell \| null) => void`      |         | The cell that holds the focus changed, or lost it.                                    |
| `menu`                | `(context: GridMenuContext) => ReactNode`  |         | Items for the end of the context menu of a cell or a row number.                      |
| `initialLayout`       | `GridLayout`                               |         | The widths, hidden columns and pins to start from, by column name.                    |
| `onLayoutChange`      | `(layout: GridLayout) => void`             |         | A person resized, hid or pinned a column.                                             |
| `empty`               | `ReactNode`                                |         | Drawn under the header while there are no rows.                                       |
| `className`           | `string`                                   |         | Its size.                                                                             |
| `ref`                 | `Ref<HTMLDivElement>`                      |         |                                                                                       |

`DataGridProps` describes further props for editing and table rows. `DataGridProps`, `GridColumn`, `GridRow`, `GridRowState`, `GridSort`, `SortDirection`, `GridLayout`, `FocusedCell`, `GridMenuContext`, `Cell`, `Value` and `ValueKind` are exported types.
