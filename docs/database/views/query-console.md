# QueryConsole

Type SQL, run it and read what each statement did. One statement or several, separated by semicolons: several give a tab each.

```tsx
import { QueryConsole } from '@adecore/database';
```

<Demo src="database/query-console" fill />

```tsx
<QueryConsole connection={connection} schema="shop" className="h-full" />
```

The demo's in-memory server only runs `SELECT * FROM <table>`; see [Testing](/database/api/testing). A real server runs any SQL its account may run.

## Running

Run, or Cmd or Ctrl and Enter, runs the selection when there is one, and otherwise the statement under the caret. Statements are told apart by their semicolons, and the splitter knows strings, quoted names and comments, so a semicolon inside one does not end a statement. Run all, or Cmd or Ctrl, Shift and Enter, runs the whole text. The toolbar says afterwards what ran: the statement, the selection or all of the statements.

While it runs the button becomes Cancel, which aborts the request. The client sends a `cancel` for it, the request ends with `cancelled` and the console says the statement was cancelled.

Each statement gets a result:

- A statement that returns rows shows them in a read-only grid, with the number of rows, the time it took and a note when more rows exist than the console shows.
- A statement that changes something shows the rows it affected and the last insert id.
- A statement that fails shows the server's message and the SQLSTATE, and it ends the list. The statements after it did not run.

The text area is a plain text area. Tab indents the lines it touches and Shift and Tab takes the indent away, and a new line starts at the indent of the one above. It has no highlighting or completion.

An `execute` is never sent twice. If the helper exited and the session was lost, the console shows `unknown-session` instead of running the SQL again, since nobody can tell whether it ran.

## Destructive statements

Before a run sends anything, the console reads the statements it is about to run. A statement that takes data or structure away with no way back opens a dialog that lists it and asks to Run anyway:

- `DROP` of any object, and `TRUNCATE`.
- `DELETE` and `UPDATE` without a `WHERE`, also behind a `WITH`.
- `ALTER` that drops a column, an index or a constraint.

A `DELETE` with a `WHERE` runs without asking. The check reads the SQL, it does not know whether the condition matches every row.

## Paging a result

A result that starts with `SELECT` or `WITH` and has more rows than a page shows Previous page, Next page and the page number in its footer. Each page is fetched with the `page` method, which wraps the statement and reads 500 rows from an offset, so a result larger than memory can be read page by page. Other statements, such as `SHOW` and `PRAGMA`, show their first 500 rows and no pager.

## Transactions

The Auto and Manual switch in the toolbar sets how a run ends. In Auto every run commits, as it does on a connection by default. In Manual the first run begins a transaction and keeps it open, and Commit and Roll back end it. An open transaction shows as a pill in the toolbar. Going back to Auto while one is open asks whether to commit or roll back first.

The console reads the real state too, not just its own switch. `execute` answers whether a transaction is open after the last statement, so a `BEGIN` typed in Auto mode shows the pill too, and a `COMMIT` clears it.

A transaction belongs to a session, and a console has a session of its own: it asks the client for a [channel](/database/api/client) that no other view uses, and closes it when it unmounts. While a console holds a transaction open, a table view or a designer on the same connection still commits what it writes at once, and the console does not see an uncommitted change of theirs. Two consoles on one connection do not share a transaction either.

## Schema

`schema` is the schema the statements run in. The helper switches to it before the first statement, and it stays selected for the session. A schema picker in the toolbar, filled from `session.schemas()`, lets a person run in another one; a new `schema` prop starts over from that. On MySQL, leave it out to use the schema the connection started in. SQLite uses `main`.

## History

Every run is recorded for its connection: the SQL, the time, whether it worked and how many rows it read or changed. The History button opens the list beside the editor. Click a run to put its SQL in the editor, double click to run it again, search by words in the SQL, and Clear history to empty it. A run of the same SQL as the one before replaces it, and the list keeps 200.

With `storage` on the [provider](/database/guide/getting-started#databaseprovider) the history is kept under `database:console-history:<connection id>` and survives a remount. Without it, it lasts for the life of the console. `defaultHistoryOpen` opens the list from the start.

## Value panel

A result grid has a value panel, like the [table view](/database/views/table-view#value-panel), that shows the whole value of the selected cell in views that fit it.

## Exporting

With `files` on the provider, the footer of a result that returned rows has an Export result button, with CSV, TSV, JSON and SQL. It exports the statement again, streamed to the file, so it writes every row the statement returns and not only the page on screen. A person picks the file in the app's dialog. See [Files](/database/guide/files).

## The text

Without `value` the console keeps the text itself, starting from `defaultValue`. Pass `value` and `onValueChange` when the app keeps the SQL, for example in a tab that survives a reload.

```tsx
<QueryConsole connection={connection} value={tab.sql} onValueChange={(sql) => saveTab({ ...tab, sql })} />
```

## Props

| Prop                 | Type                    |                                                                                                         |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `connection`         | `Connection`            | The connection to run on.                                                                               |
| `schema`             | `string`                | The schema the statements run in.                                                                       |
| `value`              | `string`                | The SQL, when the app keeps it.                                                                         |
| `defaultValue`       | `string`                | Where the text starts without `value`. Empty by default.                                                |
| `onValueChange`      | `(sql: string) => void` | The text changed.                                                                                       |
| `defaultHistoryOpen` | `boolean`               | Opens the history list from the start. `false` by default.                                              |
| `autoFocus`          | `boolean`               | Puts the caret in the editor when the console mounts, for one a person just opened. `false` by default. |
| `className`          | `string`                | The view fills its parent; this sizes it.                                                               |
| `ref`                | `Ref<HTMLDivElement>`   |                                                                                                         |

`connection` is required. `QueryConsoleProps` is an exported type. The console needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
