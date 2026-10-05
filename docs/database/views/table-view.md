# TableView

The rows of one table: read a page at a time, filtered and sorted from one command field, and editable in place. Changes pile up as pending and go to the server together on Submit.

```tsx
import { TableView } from '@adecore/database';
```

<Demo src="database/table-view" fill />

```tsx
<TableView connection={connection} schema="main" table="customers" className="h-full" />
```

The view fills the height its parent gives it: a toolbar with the command field, the grid and a status bar. A different `connection`, `schema`, `table`, `defaultWhere` or `defaultOrderBy` starts the view over, with no page and no pending change. The demo answers every filter and sort with all rows in stored order, since [`fakeDatabaseTransport`](/database/api/testing) does not read SQL.

## Reading

The view asks for the structure of the table and for the first page of rows. 500 rows make a page, and the More menu lets a person pick 100, 500 or 1000. A grid renders only the rows in view, so a big page stays cheap.

Cells are drawn by the `kind` of their column: numbers align right, `NULL` is shown as such, binary is hex with its size, and a long text is a preview that ends in an ellipsis. Numbers are written as the server wrote them, unless the provider sets `numberNotation` to `'region'`, which draws integers, decimals and floats in the person's number format with every digit kept. Editing, copying and filters keep the server's text; see [Number notation](/database/guide/getting-started#number-notation). The whole value of a long cell is fetched with the `cell` method before its editor opens, so a person edits the real value and not the preview.

## The command field

One field in the toolbar takes the conditions and the sorts. They show as chips in front of the text.

- Type a column name and a list of suggestions opens: Filter on the column, Sort by it, Jump to it. Filter on leaves the column in the field, ready for an operator and a value.
- Type a condition that reads as one, such as `quantity > 1`, `name LIKE 'A%'`, `status IN ('new', 'paid')` or `country IS NULL`, and Enter turns it into a chip. The chip quotes the column for the engine.
- Type anything else and the last suggestion, Type as SQL, takes it as raw SQL after `WHERE`. A raw condition can be anything the server accepts there.
- Click a chip to edit its text. A sort chip flips between ascending and descending. Each chip has a button that removes it, and Backspace in an empty field removes the last one.
- Escape closes the suggestions, and then clears the text. Cmd or Ctrl and F puts the focus in the field.

The conditions are joined with `AND`, each in parentheses when it holds an `OR`. The sorts apply in the order of their chips. Every change applies at once and starts again from the first page. The result reaches the server as typed; see [Security](/database/guide/security#where-and-orderby-are-sql).

A cell has the same two actions in its context menu: Filter on, which adds `column = value` (or `IS NULL`), and Exclude, which adds the opposite, and Sort by the column. The menu of a column header sorts ascending or descending and clears the sorting.

`defaultWhere` and `defaultOrderBy` start the view with filters, such as the condition of a jump along a foreign key. They win over the filters the view remembered.

## Paging and counting

The status bar shows the rows on the page, the total and the time of the read. The total starts as a guess. The helper reads one row more than the page, so a page that has a next one shows `of 501+`, and the next and previous buttons follow that. First page and Last page are in the More menu.

The `501+` is a button. Count rows asks for the real number with the `count` method, using the filters that are applied. It is a button of its own because `COUNT(*)` scans the table on some engines, and applying another filter cancels it. Once counted, the total is exact until the next change or refresh. Last page counts first when it has to.

## Selecting

A click on a column header selects the column, and Shift or Cmd or Ctrl and click extends the selection. Shift with the arrow keys or Shift and click on a cell selects a block of cells. When a selection covers more than one cell, the status bar shows how many cells and how many columns it covers, and for the cells that hold numbers their sum, average, minimum and maximum. NULLs and text are skipped. The sum and the average are computed, so they are rounded to two decimals in the person's number format. The minimum and maximum are cells, so a decimal or a large integer keeps all its digits, in the notation the provider sets.

Cmd or Ctrl and C copies the selection: the value of one cell, or a block as tab separated text. The context menu of a cell has Copy as, which writes the selected cells as TSV, CSV, JSON or SQL `INSERT` statements for the table.

A column header can be dragged wider, and a double click on its edge fits it to its content. The header menu hides a column, pins it to the left and copies its name, and shows hidden columns again.

## Editing

A cell can be edited when the connection, the table and the column allow it (see below). Enter, F2 or a double click starts an edit. Enter commits in place, Tab commits and moves to the next cell, and Escape cancels. The menu of a cell sets it to `NULL` or to its `DEFAULT`. The type of a MySQL `ENUM` or `SET` column decides the editor: a menu of the members it declares, one for an enum and several for a set, with NULL where the column allows it.

Nothing is sent yet. An edit marks the cell and counts toward the pending changes:

- Add row appends an empty row at the bottom. Columns a person leaves alone take their default.
- Delete selected rows marks the rows selected with a click, Shift-click or Cmd or Ctrl-click for deletion. A row that was added and not yet submitted is simply removed.
- Duplicate row (Cmd or Ctrl and D) adds a copy of each selected row as a new row, or of the row with the focus when none is selected. Revert row drops the changes of the selected rows.
- Submit (n) sends every pending change in one `apply` request, which is one transaction: all of them apply or none does. Revert drops them all.
- An edit that sets a cell back to what the row held removes itself.

A [schema change](/database/api/client#schema-changes) for the table's connection and schema, or one that names no schema, reloads the structure and the page and keeps the filters. With pending changes it reloads nothing and shows a banner, The table changed; reload to see it, with a Reload button. Reload asks first whether to discard the pending changes, like a refresh.

After a successful submit the page reloads. If a row changed under the person, an update or a delete matches no row or more than one, the transaction is rolled back, and the banner says which change it was, with its key. Nothing was saved, and the person refreshes and tries again.

Pending changes belong to the page they were made on. Anything that would replace the page, such as a refresh, another page, a new page size, a new filter or an import, asks first whether to discard them. `onDirtyChange` tells the app whether the view holds changes that were not submitted, so it can ask before it closes the view.

Rows are found by the row key: the primary key, or else the first unique index over columns that cannot be null. A generated column is read only.

## Record view

Record view in the More menu shows one row as a list of fields, and Previous row and Next row step through the rows of the page. It edits like the grid does, with the same pending changes, and a new row can be added from it. Closing it brings the focus back to the cell the grid had.

## Value panel

Value panel in the More menu opens a panel beside the grid with the whole value of the cell that has the focus. A long text is fetched in full. The panel has views that fit the value: Text, Formatted for a column that holds JSON, and Hex, Text and UUID for binary. Lines can wrap. A value that can be edited is changed in the panel and applied as a pending edit with Apply, which checks JSON and hex before it accepts them. Binary values show their first 16 KiB in the dump and the whole value in a copy.

## Foreign keys

A cell in a column that is part of a foreign key shows an arrow. A click on the arrow, a Cmd or Ctrl and click on the cell, or Go to referenced row in its menu asks the app to open the referenced table with `open-table` and a `where` that picks the referenced row. A key over several columns builds a condition over all of them. A cell that is NULL references nothing, and its item is disabled. The view opens nothing itself: the app decides where the table goes, and the item is not offered without an `onAction` on the [provider](/database/guide/tabs).

<Demo src="database/table-view-references" />

## Export and import

With `files` on the provider, the More menu has Export, in CSV, TSV, JSON or SQL, and Import from file. An export writes every row the filters match, not only the page. See [Files](/database/guide/files).

## Remembered layout

With `storage` on the provider, the view remembers what a person set for each table: the column widths, the hidden and pinned columns, the page size, and the filters and sorts as chips. It reads them when it mounts and writes them back after a pause, under the key `database:table:<connection id>:<schema>.<table>`. A stored value from another version of the package is ignored. Without `storage` the view starts the same every time.

## When a table is read only

Add row, Delete and editing are off, and their tooltips say why:

| Reason                                             | Message                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| The connection has `readOnly: true`.               | This connection is read only.                                                  |
| The table is a view.                               | A view cannot be edited.                                                       |
| The table has no primary key or usable unique key. | This table has no primary key or unique key, so its rows cannot be told apart. |

Import is off as well. Filtering, sorting, exporting, the record view and the value panel keep working.

<Demo src="database/table-view-read-only" fill />

## Props

| Prop             | Type                       |                                                           |
| ---------------- | -------------------------- | --------------------------------------------------------- |
| `connection`     | `Connection`               | The connection the table is in.                           |
| `schema`         | `string`                   | The schema of the table. `main` in SQLite.                |
| `table`          | `string`                   | The table or view.                                        |
| `defaultWhere`   | `string`                   | A condition the view starts with, as typed after `WHERE`. |
| `defaultOrderBy` | `string`                   | A sort the view starts with, as typed after `ORDER BY`.   |
| `onDirtyChange`  | `(dirty: boolean) => void` | Whether the view holds changes that were not submitted.   |
| `className`      | `string`                   | The view fills its parent; this sizes it.                 |
| `ref`            | `Ref<HTMLDivElement>`      |                                                           |

`connection`, `schema` and `table` are required. `TableViewProps` is an exported type. The view needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it and reads its session from the client with `client.session(connection)`, so two views on one connection share a session. A transaction a person holds open in a [console](/database/views/query-console#transactions) is not part of it.
