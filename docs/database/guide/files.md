# Files

A table or the result of a query can be written to a file, and a CSV or TSV file can be loaded into a table. Both need a path on the machine the helper runs on, and a path comes from a file dialog, which only the app can open. That makes three parts: the `files` dialogs the app hands to the provider, the `export`, `sample` and `import` requests that carry the path to the helper, and the `authorizeFile` check in the backend that decides which paths a page may use.

Without `files` on the provider the views offer no export and no import. Without `authorizeFile` on the host, every file request is refused.

## The dialogs

`DatabaseFiles` is two functions. Each resolves the absolute path the person chose, or `null` when they cancelled.

```ts
interface DatabaseFiles {
    save(options: { suggestedName: string; format: 'csv' | 'tsv' | 'json' | 'sql' }): Promise<string | null>;
    open(options: { formats: ('csv' | 'tsv')[] }): Promise<string | null>;
}
```

`suggestedName` is the table name with the extension of the format, or `result` for a query. In Electron the page asks the main process, which shows the dialog:

```ts
// main.ts
import { dialog } from 'electron';

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

Then pass the functions on:

```tsx
<DatabaseProvider
    client={client}
    files={{
        save: (options) => window.app.saveFile(options),
        open: (options) => window.app.openFile(options)
    }}
>
```

## Allowing a path

The page names the path in an `export`, `sample` or `import` request, and a page cannot be trusted to name a harmless one. A page that could pick any path could write over a file in the home folder, or read a file only to see what it contains. So the host asks the app first, on every such request, with the path, the kind of access and the owner:

```ts
authorizeFile?(path: string, access: 'read' | 'write', owner: string): boolean | Promise<boolean>
```

`export` asks for `write`. `sample` and `import` ask for `read`. A check that returns `false`, throws or rejects turns the request down with `forbidden`, before the helper sees it. Leave the option out and every file request is refused.

The safest check allows exactly the paths the person just chose in a dialog. Remember them per owner when the dialog returns (`allow` in the dialog above), and forget an owner's paths when it goes away:

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

// Where the owner's windows are released, next to `host.release(owner)`.
const forget = (owner: string): void => void chosen.delete(owner);
```

A path stays allowed for as long as its owner exists, since an import asks twice: once to read the sample and once to insert. Exporting to the same file again means picking it again, which is what a save dialog does anyway. An app that wants to be looser can allow a folder instead, such as the Downloads folder. `sample` and `import` read the file the path names, so a looser rule for `read` lets the page learn the first lines of any file it can name.

The request is also checked for shape before `authorizeFile` is asked: `path` must be absolute, `format` must be one the method takes, and an unknown key is refused.

## Exporting

In a [table view](/database/views/table-view#export-and-import), the More menu has Export, with CSV, TSV, JSON and SQL. The export respects the filters and the sort that are applied, and writes every matching row, not just the page on screen. In the [console](/database/views/query-console#exporting), the footer of a result that returned rows has an Export result button. It writes every row the statement returns, not the 500 the console shows.

```ts
await session.export({
    source: { kind: 'table', schema: 'main', table: 'orders', where: "status = 'shipped'", orderBy: 'placed_at' },
    format: 'csv',
    path: '/Users/me/Downloads/orders.csv'
});
```

`source` is `{ kind: 'table', schema, table, where?, orderBy? }` or `{ kind: 'query', sql, schema? }`. A query source is one statement that reads: `SELECT`, `WITH`, `SHOW`, `PRAGMA`, `EXPLAIN`, `DESCRIBE`, `VALUES` or `TABLE`. The call resolves with `{ rows, bytes, elapsedMs }`.

The helper streams the rows, so a table larger than memory still exports. It writes to `<path>.partial` and renames the file at the end. A failure or a cancel removes the partial file and leaves an existing file at `path` alone. Values are written whole, without the cell limit of a read. To cancel, abort the `signal` you passed in the options. The table view shows a Cancel button for that while an export runs.

| Format | What it writes                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`  | RFC 4180. Lines end in CRLF, and a header comes first unless `header` is `false`. A field with a comma, a quote or a line break is quoted. NULL and an empty string are both an empty field. |
| `tsv`  | Tab separated. A tab, a line feed, a carriage return and a backslash become `\t`, `\n`, `\r` and `\\`, and NULL is `\N`.                                                                     |
| `json` | An array of objects, written row by row. An integer beyond 2^53 and every decimal, date and time is a string. Binary values are lowercase hex strings.                                       |
| `sql`  | One `INSERT` per row, into `tableName` (the source table, or `result` for a query). Binary values are `X'..'` on SQLite and `0x..` on MySQL. Numbers of numeric columns stay unquoted.       |

## Importing

Import is in the same menu: Import from file. It is offered when the connection, the table and the table's key allow editing, and it asks first whether to discard edits that were not submitted.

1. The `open` dialog picks a CSV or TSV file. The extension decides which: `.tsv` and `.tab` are TSV, anything else is CSV.
2. The client reads the first lines with `client.sample(path, format, header)`, which resolves with the column names and the first rows as strings.
3. A dialog maps the columns of the file to the columns of the table and shows the first rows. Names are matched without regard to case, a table column takes at most one file column, and a file without a header maps its columns to the table's in order. A file column can be skipped, and a generated column cannot be a target.
4. Import runs `session.import(schema, table, { path, format, header, columns })`. `columns` has one entry per field of a line: the name of the column it goes into, or `null` to skip it. The call resolves with the number of rows inserted.

```ts
const { columns: fileColumns } = await client.sample('/Users/me/orders.csv', 'csv', true);
const inserted = await session.import('main', 'orders', {
    path: '/Users/me/orders.csv',
    format: 'csv',
    header: true,
    columns: fileColumns.map((name) => (name === 'internal_note' ? null : name))
});
```

The helper reads the file in batches and inserts them in one transaction, so a file that fails halfway inserts nothing. When a transaction the person drives is open, the import runs as a savepoint inside it. A field that is empty, or `\N`, becomes NULL, and in a TSV file the escapes are undone first. Every line needs as many fields as `columns` has entries. A failed insert is retried row by row to find the line, and the message names it: `Line 42: Duplicate entry '7' for key 'PRIMARY'`, with the SQLSTATE. A file that is broken in itself, such as a line with too few fields, fails with `file-failed`. A read only connection answers `read-only`.

## Try it without a backend

[`fakeDatabaseTransport`](/database/api/testing) has no files. It answers `export`, `sample` and `import` with `unsupported`, so the demos on this site show no export and no import. An app that tests its dialogs can answer those methods itself in a transport that wraps the fake.
