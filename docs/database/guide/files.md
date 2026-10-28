# Files

Export writes a table or query result to a file, and import loads a CSV or TSV file into a table. Both need a path on the helper's machine from a dialog only the app can show. Three parts work together:

- `files` on the [provider](/database/guide/getting-started#databaseprovider) opens the app's dialogs. Without it the views offer no export or import.
- The `export`, `sample` and `import` requests carry the path to the helper.
- `authorizeFile` on the host decides which paths a page may use. Without it every file request fails with `forbidden`.

<Demo src="database/table-view-files" />

The demo answers the dialogs and file requests in the page. In the More menu, Export reports the rows it would write, and Import from file loads three customers from a CSV file.

## The dialogs

`DatabaseFiles` is two functions. Each resolves the chosen absolute path, or `null` on cancel.

```ts
interface DatabaseFiles {
    save(options: { suggestedName: string; format: 'csv' | 'tsv' | 'json' | 'sql' }): Promise<string | null>;
    open(options: { formats: ('csv' | 'tsv')[] }): Promise<string | null>;
}
```

`suggestedName` is the table name, or `result` for a query, with the format's extension. In Electron the main process shows the dialog and remembers the returned path for the check below:

```ts
// main.ts
import { dialog, ipcMain } from 'electron';

ipcMain.handle('files:save', async (event, options: { suggestedName: string; format: string }) => {
    if (!isTrustedSender(event.senderFrame)) {
        throw new Error('Untrusted sender.');
    }

    const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: options.suggestedName,
        filters: [{ name: options.format.toUpperCase(), extensions: [options.format] }]
    });

    return canceled ? null : allow(String(event.sender.id), filePath, 'write');
});
```

```tsx
<DatabaseProvider client={client} files={{ save: (options) => window.app.saveFile(options), open: (options) => window.app.openFile(options) }}>
```

## Allowing a path

The page names the path in each request, so it could overwrite any file or read the first lines of one it should not see. The host calls `authorizeFile(path, access, owner)` on every request: `'write'` for an `export`, `'read'` for a `sample` or `import`. A check that returns `false`, throws or rejects fails the request with `forbidden` before the helper sees it.

The safest check allows exactly the paths the person chose in a dialog. Remember them per owner when the dialog returns (`allow` above), and forget them when the owner goes away:

```ts
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';

const chosen = new Map<string, Set<string>>();

const allow = (owner: string, path: string, access: 'read' | 'write'): string => {
    const owned = chosen.get(owner) ?? new Set<string>();
    owned.add(`${access}:${path}`);
    chosen.set(owner, owned);
    return path;
};

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath),
    authorizeFile: (path, access, owner) => chosen.get(owner)?.has(`${access}:${path}`) === true
});

// Next to `host.release(owner)`.
const forget = (owner: string): void => void chosen.delete(owner);
```

Keep a path allowed while its owner exists, since an import reads the file twice: for the sample and to insert. An app can allow a whole folder, such as Downloads, but a looser `'read'` rule lets the page read the first lines of any file there. By the time the check runs, `path` is absolute and `format` is valid.

## Exporting

The More menu of a [table view](/database/views/table-view#export-and-import) has Export, in CSV, TSV, JSON or SQL. It writes every row that matches the filters, in their sort. A [console](/database/views/query-console#exporting) result has Export result, which runs the statement again and writes every row.

```ts
await session.export({
    source: { kind: 'table', schema: 'main', table: 'orders', where: "status = 'shipped'", orderBy: 'placed_at' },
    format: 'csv',
    path: '/Users/me/Downloads/orders.csv'
});
```

`source` is a table (`{ kind: 'table', schema, table, where?, orderBy? }`) or one reading statement (`{ kind: 'query', sql, schema? }`), starting with `SELECT`, `WITH`, `SHOW`, `PRAGMA`, `EXPLAIN`, `DESCRIBE`, `DESC`, `VALUES` or `TABLE`. The call resolves with `{ rows, bytes, elapsedMs }`.

The helper streams rows, so a table larger than memory still exports, with every value whole. A failed or cancelled export leaves an existing file at `path` untouched, and of two exports to one `path` the last to finish wins. To cancel, abort the `signal` in the options; the table view has a Cancel button for that.

| Format | What it writes                                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`  | RFC 4180, with CRLF line ends and a header unless `header` is `false`. A field with a comma, a quote or a line break is quoted. NULL and an empty string are both an empty field. |
| `tsv`  | Tab separated. A tab, a line feed, a carriage return and a backslash become `\t`, `\n`, `\r` and `\\`, and NULL is `\N`.                                                          |
| `json` | An array of objects. An integer beyond 2^53 and every decimal, date and time is a string, and binary is a lowercase hex string.                                                   |
| `sql`  | One `INSERT` per row, into `tableName` (the source table, or `result` for a query). Binary is `X'..'` on SQLite and `0x..` on MySQL.                                              |

## Importing

Import from file sits in the same menu for editable tables. It first asks whether to discard unsubmitted edits.

1. The `open` dialog picks the file. A `.tsv` or `.tab` extension means TSV, anything else CSV.
2. `client.sample(path, format, header)` reads the column names and the first rows as strings.
3. A dialog maps file columns to table columns. Names match case-insensitively, each table column takes at most one file column, and a file without a header maps in order. File columns can be skipped, and generated columns are no target.
4. `session.import(schema, table, { path, format, header, columns })` resolves with the number of inserted rows. `columns` has one entry per field: the target column, or `null` to skip it.

```ts
const { columns: fileColumns } = await client.sample('/Users/me/orders.csv', 'csv', true);
const inserted = await session.import('main', 'orders', {
    path: '/Users/me/orders.csv',
    format: 'csv',
    header: true,
    columns: fileColumns.map((name) => (name === 'internal_note' ? null : name))
});
```

The helper inserts the whole file in one transaction, so a failure halfway inserts nothing. Inside an open transaction it runs as a savepoint. An empty field or `\N` becomes NULL. A failed insert names its line, such as `Line 42: Duplicate entry '7' for key 'PRIMARY'`, with the SQLSTATE. A broken file, such as a line whose field count differs from `columns`, fails with `file-failed`. A read only connection fails with `read-only`.

## Without a backend

[`fakeDatabaseTransport`](/database/api/testing) has no files and answers `export`, `sample` and `import` with `unsupported`. The demo above wraps its client to answer them in the page, which a test of an app's dialogs can do too.
