# TableView

The rows of one table: read a page at a time, filtered and sorted with SQL a person types, and editable in place. Changes pile up as pending and go to the server together on Submit.

```tsx
import { TableView } from '@adecore/database';
```

<Demo src="database/table-view" fill />

```tsx
<TableView connection={connection} schema="main" table="customers" className="h-full" />
```

The view fills the height its parent gives it: a toolbar, the grid and a footer. A different `connection`, `schema` or `table` starts the view over, with no filter, no page and no pending change. The demo answers every `where` and `orderBy` with all rows, since [`fakeDatabaseTransport`](/database/api/testing) does not read SQL.

## Reading

The grid asks for the structure of the table and for the first page of rows. 500 rows make a page, and the footer lets a person pick 100, 500 or 1000. A grid renders only the rows in view, so a big page stays cheap.

Cells are drawn by the `kind` of their column: numbers align right, `NULL` is shown as such, binary is hex with its size, and a long text is a preview that ends in an ellipsis. The whole value of a long cell is fetched with the `cell` method before its editor opens, so a person edits the real value and not the preview.

The two filter boxes in the toolbar are SQL after `WHERE` and `ORDER BY`. Enter applies them, and Escape clears the box. They reach the server as typed; see [Security](/database/guide/security#where-and-orderby-are-sql).

## Paging and counting

The footer shows the time of the read, which rows are on the page and the total. The total starts as a guess. The helper reads one row more than the page, so a page that has a next one shows `of 501+`, and the next and previous buttons follow `hasMore`.

Count rows asks for the real number with the `count` method, using the filter that is applied. It is a button of its own because `COUNT(*)` scans the table on some engines, and applying another filter cancels it. Once counted, the total is exact until the next change or refresh.

## Editing

A cell can be edited when the connection, the table and the column allow it (see below). Enter, F2 or a double click starts an edit. Enter commits in place, Tab commits and moves to the next cell, and Escape cancels. The menu of a cell sets it to `NULL` or to its `DEFAULT`.

Nothing is sent yet. An edit marks the cell and counts toward the pending changes:

- Add row appends an empty row at the bottom. Columns a person leaves alone take their default.
- Delete selected rows marks the rows selected with a click, Shift-click or Cmd or Ctrl-click for deletion. A row that was added and not yet submitted is simply removed.
- Submit (n) sends every pending change in one `apply` request, which is one transaction: all of them apply or none does. Revert drops them.
- An edit that sets a cell back to what the row held removes itself.

After a successful submit the page reloads. If a row changed under the person, an update or a delete matches no row or more than one, the transaction is rolled back, and the banner says which change it was, with its key. Nothing was saved, and the person refreshes and tries again.

Pending changes belong to the page they were made on. Anything that would replace the page, such as a refresh, another page, a new page size or a new filter, asks first whether to discard them.

Rows are found by the row key: the primary key, or else the first unique index over columns that cannot be null. A generated column is read only.

## When a table is read only

Add row, Delete and editing are off, and their tooltips say why:

| Reason | Message |
| --- | --- |
| The connection has `readOnly: true`. | This connection is read only. |
| The table is a view. | A view cannot be edited. |
| The table has no primary key or usable unique key. | This table has no primary key or unique key, so its rows cannot be told apart. |

<Demo src="database/table-view-read-only" fill />

## Props

| Prop | Type | |
| --- | --- | --- |
| `connection` | `Connection` | The connection the table is in. |
| `schema` | `string` | The schema of the table. `main` in SQLite. |
| `table` | `string` | The table or view. |
| `className` | `string` | The view fills its parent; this sizes it. |
| `ref` | `Ref<HTMLDivElement>` | |

`connection`, `schema` and `table` are required. `TableViewProps` is an exported type. The view needs a [`DatabaseProvider`](/database/guide/getting-started#mount-the-page) above it and reads its session from the client with `client.session(connection)`, so two views on one connection share a session.
