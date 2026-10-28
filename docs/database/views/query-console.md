# QueryConsole

Type SQL, run it and read what each statement did. Each statement gets a result tab.

```tsx
import { QueryConsole } from '@adecore/database';
```

<Demo src="database/query-console" fill />

```tsx
<QueryConsole connection={connection} schema="shop" className="h-full" />
```

The demo's in-memory server only runs `SELECT * FROM <table>`; see [Testing](/database/api/testing).

## Running

Run (Cmd or Ctrl+Enter) runs the selection, or the statement under the caret. Run all (Cmd or Ctrl+Shift+Enter) runs the whole text. Statements split on semicolons outside strings, quoted names and comments.

During a run, Run becomes Cancel. A run cancelled midway shows the statements that ran, a tab for the stopped one, and any transaction it left open. A run that failed as a whole, or was cancelled before anything ran, says so above the results.

- A statement that returns rows shows them in a grid, with the row count and time.
- A statement that changes something shows the affected rows and the last insert id.
- A failed statement shows the server's message and SQLSTATE. Later statements did not run.

The editor is a plain text area without highlighting or completion. Tab and Shift+Tab indent and outdent the selected lines, and a new line keeps the indent above. See [Your own editor](#your-own-editor) for a replacement.

A run is never sent twice. When the session was lost, the console shows the `unknown-session` error instead of running the SQL again.

## Results

Before the first run the editor fills the console. A run opens the results below it as a split. Drag the divider to resize, or Close results to hide them until the next run.

The results start at half the console. The dragged height is kept in the provider's `storage` under `database:console-results`, in pixels, for every console.

## Keys in the results

A result column that the server traces to a table column shows that column's key icons in its header, as in a [table view](/database/views/table-view): a yellow key for a primary key and a blue one for a foreign key. Computed columns and tables the server cannot describe, such as a MariaDB derived table, get no icon. See [where a result column comes from](/database/guide/protocol#methods).

With `onAction` on the provider, a foreign key cell offers Go to referenced row in its menu, and Cmd or Ctrl+click follows it, with `open-table` and a `where` for the referenced row. In a join, each key follows the columns of its own table.

## Destructive statements

Before a run, a statement that removes data or structure opens a dialog that lists it, with Run anyway:

- `DROP`, and `TRUNCATE`.
- `DELETE` and `UPDATE` without a `WHERE`, also behind a `WITH`.
- `ALTER` that drops a column, an index or a constraint.

The check reads the SQL only, so a `WHERE` that matches every row runs without asking.

## Paging a result

A `SELECT` or `WITH` result with more than 500 rows shows Previous page and Next page in its footer. Each page is a [`page`](/database/guide/protocol#reading-a-result-in-pages) request of up to 500 rows. Other statements, such as `SHOW` and `PRAGMA`, show their first 500 rows only.

## Transactions

The Auto-commit switch sets how a run ends. On, every run commits. Off, the next run begins a transaction that stays open until Commit or Roll back. An open transaction shows a toolbar pill with Commit and Roll back. Turning Auto-commit on during one asks whether to commit or roll back.

The pill follows the connection, not the switch, so a typed `BEGIN` shows it and a `COMMIT` clears it.

Each console runs on its own [channel](/database/api/client#createdatabaseclient), closed on unmount. A table view or designer on the same connection commits at once and does not see the console's uncommitted changes. Two consoles do not share a transaction.

## Schema

`schema` is where the statements run, and it stays selected for the session. On MySQL the toolbar has a schema picker, which a new `schema` prop resets. Without `schema`, the console stays in the connection's starting schema. SQLite uses `main`.

With `onSchemaChange`, the app owns the schema. Picking another calls `onSchemaChange` and changes nothing until the app passes the new `schema`. Use it when the app keeps the schema with something of its own, such as a file.

```tsx
<QueryConsole connection={connection} schema={schema} onSchemaChange={setSchema} className="h-full" />
```

## History

The History button lists the connection's runs beside the editor: the SQL, the time, whether it worked and the rows read or changed. Click a run to load its SQL, double click to run it again, search, or Clear history. Repeating the last SQL replaces its entry, and the list keeps 200. With `storage` on the [provider](/database/guide/getting-started#databaseprovider) it survives a remount.

## Value panel

The Value panel of a result shows the selected cell's whole value, like the [value editor](/database/views/table-view#value-editor) of a table view.

## Exporting

With `files` on the provider, a result with rows has Export result, as CSV, TSV, JSON or SQL. It runs the statement again and streams every row to the chosen file. See [Files](/database/guide/files).

## Your own editor

`renderEditor` replaces the text area with the app's editor, such as a code editor with a language server. The console keeps the toolbar, schema, transactions, history, results, paging and export. It calls `renderEditor` with a `QueryConsoleEditorProps`:

| Prop            | Type                                    |                                                                                                                                    |
| --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ref`           | `Ref<QueryConsoleEditorHandle>`         | The editor's handle, so a run reads its selection. |
| `value`         | `string`                                | The SQL. |
| `onValueChange` | `(sql: string) => void`                 | Every edit. It reaches the console's own `onValueChange`. |
| `run`           | `(scope: QueryConsoleRunScope) => void` | Runs what the scope names, like Run and Run all. Does nothing while `busy` or when there is nothing to run. |
| `busy`          | `boolean`                               | A run or the end of a transaction is under way. |
| `label`         | `string`                                | The editor's accessible name. |
| `placeholder`   | `string`                                | Shown while the editor is empty. |
| `autoFocus`     | `boolean`                               | The console's `autoFocus`. |

`QueryConsoleRunScope` is `'selection-or-statement'` or `'all'`. `QueryConsoleEditorHandle` has one method, `selection()`, which returns `{ start, end }` text offsets, equal for a caret. Without a handle, every run takes the whole text.

The editor binds its own keys. `runScopeOf(event, apple)` turns a key event into a `QueryConsoleRunScope`, or `null` for other keys. The built-in text area uses it too, so an editor that binds through it stays in sync. The editor fills the space under the toolbar, edge to edge.

```tsx
import { runScopeOf } from '@adecore/database';
import { isApplePlatform } from '@adecore/ui';

function SqlCodeEditor({ ref, value, onValueChange, run, label, autoFocus }: QueryConsoleEditorProps) {
    const editor = useRef<CodeEditorHandle>(null);

    useImperativeHandle(ref, () => ({ selection: () => editor.current!.selection() }), []);

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        const scope = runScopeOf(event, isApplePlatform());
        if (scope !== null) {
            event.preventDefault();
            run(scope);
        }
    };

    return (
        <CodeEditor
            ref={editor}
            language="sql"
            value={value}
            onValueChange={onValueChange}
            aria-label={label}
            autoFocus={autoFocus}
            onKeyDown={handleKeyDown}
            className="h-full"
        />
    );
}

<QueryConsole connection={connection} value={sql} onValueChange={setSql} renderEditor={(editor) => <SqlCodeEditor {...editor} />} className="h-full" />;
```

## Your own content in the bar

`toolbarEnd` draws the app's content at the end of the bar, before the schema picker and History, such as a connection picker.

Without `connection`, the console draws its editor and a bar with only `toolbarEnd`, and runs nothing. Once the app passes a connection, the full bar appears. The editor stays mounted across the change and keeps its state.

```tsx
<QueryConsole connection={connection} toolbarEnd={<ConnectionPicker value={connection.id} onValueChange={switchConnection} />} className="h-full" />
```

## Props

| Prop                 | Type                                             | Default |                                                                            |
| -------------------- | ------------------------------------------------ | ------- | -------------------------------------------------------------------------- |
| `connection`         | `Connection`                                     |         | The connection to run on. Without it nothing runs.                         |
| `schema`             | `string`                                         |         | The schema the statements run in.                                          |
| `onSchemaChange`     | `(schema: string) => void`                       |         | Lets the app own the schema; the picker asks through it.                   |
| `value`              | `string`                                         |         | The SQL, when the app keeps it.                                            |
| `defaultValue`       | `string`                                         | `''`    | The starting text without `value`.                                         |
| `onValueChange`      | `(sql: string) => void`                          |         | The text changed.                                                          |
| `defaultHistoryOpen` | `boolean`                                        | `false` | Opens the history from the start.                                          |
| `autoFocus`          | `boolean`                                        | `false` | Focuses the editor on mount.                                               |
| `renderEditor`       | `(editor: QueryConsoleEditorProps) => ReactNode` |         | The app's own editor. See [Your own editor](#your-own-editor).             |
| `toolbarEnd`         | `ReactNode`                                      |         | The app's own content before the schema picker and History.                |
| `className`          | `string`                                         |         | Its size.                                                                  |
| `ref`                | `Ref<HTMLDivElement>`                            |         |                                                                            |

`QueryConsoleProps`, `QueryConsoleEditorProps`, `QueryConsoleEditorHandle` and `QueryConsoleRunScope` are exported types. The console needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
