# QueryConsole

Type SQL, run it and read what each statement did. Several statements, separated by semicolons, give a result tab each.

```tsx
import { QueryConsole } from '@adecore/database';
```

<Demo src="database/query-console" fill />

```tsx
<QueryConsole connection={connection} schema="shop" className="h-full" />
```

The demo's in-memory server only runs `SELECT * FROM <table>`; see [Testing](/database/api/testing).

## Running

Run, or Cmd or Ctrl and Enter, runs the selection, or the statement under the caret when nothing is selected. Run all, or Cmd or Ctrl, Shift and Enter, runs the whole text. The statements are split on semicolons outside strings, quoted names and comments. Afterwards the toolbar says what ran.

While a run is busy, Run becomes Cancel, which aborts the request and sends a `cancel` for it.

- A statement that returns rows shows them in a grid, with the number of rows and the time it took.
- A statement that changes something shows the rows it affected and the last insert id.
- A statement that fails shows the server's message and SQLSTATE. The statements after it did not run.

The editor is a plain text area without highlighting or completion. Tab and Shift and Tab indent and outdent the lines a selection touches, and a new line keeps the indent of the one above.

A run is never sent twice. When the helper exited and the session was lost, the console shows the `unknown-session` error instead of running the SQL again.

## Destructive statements

Before it sends a run, the console reads its statements. A statement that removes data or structure opens a dialog that lists it, with Run anyway:

- `DROP`, and `TRUNCATE`.
- `DELETE` and `UPDATE` without a `WHERE`, also behind a `WITH`.
- `ALTER` that drops a column, an index or a constraint.

The check reads the SQL only: a `WHERE` that matches every row runs without asking.

## Paging a result

A result of a statement that starts with `SELECT` or `WITH` and has more than 500 rows shows Previous page and Next page in its footer. Each page is a [`page`](/database/guide/protocol#reading-a-result-in-pages) request of 500 rows, so a result larger than memory can be read page by page. Other statements, such as `SHOW` and `PRAGMA`, show their first 500 rows only.

## Transactions

The Auto and Manual switch sets how a run ends. Auto commits every run. Manual begins a transaction on the next run and keeps it open until Commit or Roll back. An open transaction shows a pill in the toolbar, and switching back to Auto while one is open asks whether to commit or roll back.

The pill follows the connection, not the switch: `execute` reports whether a transaction is open, so a `BEGIN` typed in Auto shows the pill and a `COMMIT` clears it.

Each console runs on a [channel](/database/api/client#createdatabaseclient) of its own, which it closes when it unmounts. While a console holds a transaction open, a table view or the designer on the same connection still commits at once, and neither sees the console's uncommitted changes. Two consoles do not share a transaction either.

## Schema

`schema` is where the statements run: the helper switches to it before the first statement, and it stays selected for the session. On MySQL the toolbar has a schema picker, and a new `schema` prop resets it. Leave `schema` out to stay in the schema the connection started in. SQLite uses `main`.

## History

The History button opens the runs of the connection beside the editor: the SQL, the time, whether it worked and the rows it read or changed. Click a run to put its SQL in the editor, double click to run it again, search by words, or Clear history. A run of the same SQL as the last one replaces it, and the list keeps 200. With `storage` on the [provider](/database/guide/getting-started#databaseprovider) it survives a remount.

## Value panel

The Value panel of a result shows the whole value of the selected cell, like the [value editor](/database/views/table-view#value-editor) of a table view.

## Exporting

With `files` on the provider, a result with rows has Export result, as CSV, TSV, JSON or SQL. It runs the statement again and streams every row it returns to the file the person picks, not only the page on screen. See [Files](/database/guide/files).

## Props

| Prop                 | Type                    | Default |                                                                            |
| -------------------- | ----------------------- | ------- | -------------------------------------------------------------------------- |
| `connection`         | `Connection`            |         | Required. The connection to run on.                                        |
| `schema`             | `string`                |         | The schema the statements run in.                                          |
| `value`              | `string`                |         | The SQL, when the app keeps it, such as in a tab that survives a reload.   |
| `defaultValue`       | `string`                | `''`    | Where the text starts without `value`.                                     |
| `onValueChange`      | `(sql: string) => void` |         | The text changed.                                                          |
| `defaultHistoryOpen` | `boolean`               | `false` | Opens the history from the start.                                          |
| `autoFocus`          | `boolean`               | `false` | Puts the caret in the editor on mount, for a console a person just opened. |
| `className`          | `string`                |         | Its size.                                                                  |
| `ref`                | `Ref<HTMLDivElement>`   |         |                                                                            |

`QueryConsoleProps` is an exported type. The console needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
