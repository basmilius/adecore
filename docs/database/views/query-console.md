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

Run, or Cmd or Ctrl and Enter, sends the text to the server with `session.execute`. While it runs the button becomes Cancel, which aborts the request. The client sends a `cancel` for it, the request ends with `cancelled` and the console says the statement was cancelled.

Each statement gets a result:

- A statement that returns rows shows them in a read-only grid, with the number of rows, the time it took and a note when more rows exist than the console shows. A console shows 500 rows per result.
- A statement that changes something shows the rows it affected and the last insert id.
- A statement that fails shows the server's message and the SQLSTATE, and it ends the list. The statements after it did not run.

The text area is a plain text area for now. It has no highlighting or completion.

An `execute` is never sent twice. If the helper exited and the session was lost, the console shows `unknown-session` instead of running the SQL again, since nobody can tell whether it ran.

## Schema

`schema` is the schema the statements run in. The helper switches to it before the first statement, and it stays selected for the session. On MySQL, leave it out to use the schema the connection started in. SQLite uses `main`.

## The text

Without `value` the console keeps the text itself, starting from `defaultValue`. Pass `value` and `onValueChange` when the app keeps the SQL, for example in a tab that survives a reload.

```tsx
<QueryConsole connection={connection} value={tab.sql} onValueChange={(sql) => saveTab({ ...tab, sql })} />
```

## Props

| Prop | Type | |
| --- | --- | --- |
| `connection` | `Connection` | The connection to run on. |
| `schema` | `string` | The schema the statements run in. |
| `value` | `string` | The SQL, when the app keeps it. |
| `defaultValue` | `string` | Where the text starts without `value`. Empty by default. |
| `onValueChange` | `(sql: string) => void` | The text changed. |
| `className` | `string` | The view fills its parent; this sizes it. |
| `ref` | `Ref<HTMLDivElement>` | |

`connection` is required. `QueryConsoleProps` is an exported type.
