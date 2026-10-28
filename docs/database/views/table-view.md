# TableView

The rows of one table, a page at a time, filtered and sorted from one command field and editable in place. Edits stay pending until Submit sends them together.

```tsx
import { TableView } from '@adecore/database';
```

<Demo src="database/table-view" fill />

```tsx
<TableView connection={connection} schema="main" table="customers" className="h-full" />
```

The view fills its parent with a toolbar, the grid and a status bar. A new `connection`, `schema`, `table`, `defaultWhere` or `defaultOrderBy` starts it over and drops pending changes. The demo ignores filters and sorts, since [`fakeDatabaseTransport`](/database/api/testing) does not read SQL.

## Reading

The view loads the table's structure and its first page of rows, 500 by default. Rows per page in the More menu offers 100, 500 and 1000.

A cell draws by its column's `kind`: numbers align right, NULL reads `NULL`, binary shows as hex with its size, and long text as a preview. Numbers appear as the server wrote them, unless the provider's [`numberNotation`](/database/guide/getting-started#number-notation) is `'region'`. Before editing a preview, the view fetches the whole value with `cell`.

Cells, headers and record view field names use the code font at [`--code-font-size`](/ui/guide/theme). [Console](/database/views/query-console) results draw the same grid.

## The command field

The toolbar field holds filters and sorts as chips before the text. Cmd or Ctrl+F focuses it.

- Type a column name for suggestions: Filter on, Sort by and Jump to the column.
- Type a condition, such as `quantity > 1`, `name LIKE 'A%'`, `status IN ('new', 'paid')` or `country IS NULL`, and Enter makes it a chip with the column quoted for the engine.
- Anything else becomes a raw condition through the last suggestion, Type as SQL.
- Click a chip to edit it, or a sort chip to flip its direction. Backspace in an empty field removes the last chip. Escape closes the suggestions, then clears the text.

Filters join with `AND`, and sorts apply in chip order. Every change applies at once, from the first page. The text reaches the server as typed; see [Security](/database/guide/security#where-and-orderby-are-sql).

A cell's menu has Filter on (`column = value`, or `IS NULL`), Exclude and Sort by. A header's menu sorts or clears the sort. `defaultWhere` and `defaultOrderBy` set starting filters, such as a foreign key jump's condition, and override remembered ones.

## Paging and counting

The status bar shows the rows on the page, the total and the read time. Until counted, the total is a lower bound such as `of 501+`. Click it to count matching rows with `count`, which can be slow on a big table; a new filter cancels it. First page and Last page are in the More menu, and Last page counts first when needed. A page of wide rows can hold fewer rows than the page size; Next page continues after the last row shown.

## Selecting and copying

Click a header to select a column, and Shift or Cmd or Ctrl+click to add more. Shift with arrows or a click selects a block. For several cells, the status bar shows the count and, over the numbers, the sum, average, minimum and maximum.

Cmd or Ctrl+C copies one value, or a block as tab separated text. Copy as in a cell's menu writes TSV, CSV, JSON or SQL `INSERT` statements.

A copy fetches whole values for previews first, up to 16 MiB. A value it cannot fetch, or a larger selection, is copied as its preview, with a notice.

Drag a header edge to resize a column, or double click it to fit. The header menu hides, pins, copies the name and shows hidden columns.

## Editing

A cell is editable when the connection, table and column allow it. Enter, F2 or a double click starts an edit. Enter commits, Tab commits and moves on, and Escape cancels. A cell's menu sets `NULL` or `DEFAULT`. A MySQL `ENUM` or `SET` column edits in a menu of its members.

An edit is pending until Submit:

- Add row appends an empty row. Untouched columns take their default.
- Delete marks the selected rows. An unsubmitted new row is removed at once.
- Cmd or Ctrl+D duplicates the selected or focused rows as new rows. Revert row drops the selected rows' edits.
- Submit sends every pending change in one `apply`, all or none. Revert drops them all.
- An edit back to the original value removes itself.

After a submit the page reloads. If an update or delete matches zero or several rows on the server, nothing is saved, and a banner names the change and its key.

A refresh, page change, new filter or import asks first whether to discard pending changes. `onDirtyChange` tells the app whether any exist, so it can ask before closing the view.

A [schema change](/database/api/client#schema-changes) for the table's schema reloads the structure and page. With pending changes it shows a banner with Reload instead.

Rows are found by the row key: the primary key, else the first unique index over non-null columns. Generated columns are read only.

## Record view

The record view button, or Record view in the More menu, opens one row's fields in a sidebar. It follows the grid's focus. Previous row and Next row, or Cmd or Ctrl+Up and Down, move it and the grid's focus. Drag the left edge to resize; with `storage` on the provider the width is kept under `database:record-view`, in pixels.

Fields edit into the same pending changes as the grid. Enter takes the edit, Escape drops it, and Tab or Up and Down move between fields. A foreign key field has an arrow to the referenced row.

### Value editor

A long text, JSON or binary value expands in place to its whole value. It shows Text, Formatted for JSON, or Hex, Text and UUID for binary, with the binary dump capped at 16 KiB. An editable value changes there, and Apply adds it as a pending edit after checking JSON and hex.

## Foreign keys

Cmd or Ctrl+click on a foreign key cell, or Go to referenced row in its menu, sends `open-table` with a `where` for the referenced row. The record view shows an arrow beside the field. A NULL cell references nothing. Without `onAction` on the [provider](/database/guide/tabs) none of this is offered.

<Demo src="database/table-view-references" />

## Export and import

With `files` on the provider, the More menu has Export (CSV, TSV, JSON or SQL) and Import from file. An export writes every matching row, not only the page. See [Files](/database/guide/files).

<Demo src="database/table-view-files" />

## Remembered layout

With `storage` on the provider, the view remembers per table the column widths, hidden and pinned columns, page size, filters and sorts, under `database:table:<connection id>:<schema>.<table>`.

## When a table is read only

Add row, Delete, editing and import are off, and their tooltips say why:

| Reason                                             | Message                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| The connection has `readOnly: true`.               | This connection is read only.                                                  |
| The table is a view.                               | A view cannot be edited.                                                       |
| The table has no primary key or usable unique key. | This table has no primary key or unique key, so its rows cannot be told apart. |

Filtering, sorting, export and the record view keep working, with read only fields.

<Demo src="database/table-view-read-only" fill />

## Your own content in the toolbar

`toolbarStart` draws the app's content before the command field, such as a breadcrumb. Separators then split the bar into three groups: yours, the command field and the buttons.

```tsx
<TableView connection={connection} schema="main" table="orders" toolbarStart={<Breadcrumb connection={connection} schema="main" />} />
```

## Props

| Prop             | Type                       | Default |                                                         |
| ---------------- | -------------------------- | ------- | ------------------------------------------------------- |
| `connection`     | `Connection`               |         | Required. The connection the table is in.               |
| `schema`         | `string`                   |         | Required. The schema of the table, `main` in SQLite.    |
| `table`          | `string`                   |         | Required. The table or view.                            |
| `toolbarStart`   | `ReactNode`                |         | The app's own content at the start of the toolbar.      |
| `defaultWhere`   | `string`                   |         | A filter the view starts with, as typed after `WHERE`.  |
| `defaultOrderBy` | `string`                   |         | A sort the view starts with, as typed after `ORDER BY`. |
| `onDirtyChange`  | `(dirty: boolean) => void` |         | Whether the view holds pending changes.                 |
| `className`      | `string`                   |         | Its size.                                               |
| `ref`            | `Ref<HTMLDivElement>`      |         |                                                         |

`TableViewProps` is an exported type. The view needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it. Table views on one connection share its default session, outside any [console](/database/views/query-console#transactions) transaction.
