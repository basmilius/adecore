# Testing

`@adecore/database/testing` has a transport that answers the protocol from memory. The demos on this site run on it, and so can an app's tests, without a helper or server.

```ts
import { fakeDatabaseTransport, type FakeDatabase, type FakeDatabaseTransportOptions, type FakeTable } from '@adecore/database/testing';
```

## fakeDatabaseTransport

```ts
const client = createDatabaseClient(fakeDatabaseTransport({ databases: { '/data/shop.sqlite': shop }, latencyMs: 150 }));
```

It returns a `DatabaseTransport`.

`FakeDatabaseTransportOptions`:

| Option       | Type                                     | Default         |                                                                                                                                       |
| ------------ | ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `databases`  | `Readonly<Record<string, FakeDatabase>>` |                 | Required. The data, keyed by the `path` of a SQLite connection or the `host` of a MySQL one. Another key fails with `connect-failed`. |
| `latencyMs`  | `number`                                 | `0`             | Delays every answer except `cancel`.                                                                                                  |
| `server`     | `ServerInfo`                             | from the engine | What `open` and `test` report.                                                                                                        |
| `containers` | `readonly DockerContainer[]`             | `[]`            | What `discover` lists.                                                                                                                |

The fake ignores tunnels and always looks up a MySQL server by `host`, so a Docker connection from the form finds the database under `127.0.0.1`. Each transport works on its own copy of `databases`, and `apply` changes last as long as the transport.

## The data

A `FakeDatabase` is `{ schemas }`: schema name to table name to a `FakeTable`. SQLite uses the schema `main`.

| Field                    |                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `columns`                | The `ColumnInfo` list. Required.                                                                                           |
| `rows`                   | One entry per row, its `Value`s in the order of `columns`. Required.                                                       |
| `primaryKey`             | The columns of the primary key, which is also the row key.                                                                 |
| `kind`                   | `table` by default. A view cannot be edited.                                                                               |
| `indexes`, `foreignKeys` | What `structure` reports. Without a primary key, a unique index over non-null columns is the row key.                      |
| `checks`, `triggers`     | What `structure` reports, or absent.                                                                                       |
| `ddl`                    | The `CREATE` statement `structure` reports.                                                                                |

```ts
const shop: FakeDatabase = {
    schemas: {
        main: {
            customers: {
                columns: [
                    { name: 'id', type: 'integer', kind: 'integer', nullable: false, defaultValue: null, autoIncrement: true, generated: false, comment: null },
                    { name: 'name', type: 'text', kind: 'text', nullable: false, defaultValue: null, autoIncrement: false, generated: false, comment: null }
                ],
                primaryKey: ['id'],
                rows: [
                    [1, 'Amara Okafor'],
                    [2, 'Bram de Vries']
                ]
            }
        }
    }
};
```

## What it answers

- `open`, `test`, `close`, `schemas`, `tables` and `structure` answer from the data. The schemas `information_schema`, `mysql`, `performance_schema` and `sys` are `system`.
- `rows` pages with `offset` and `limit`, reports `hasMore` and cuts cells past `cellLimit` into previews. It, `execute` and `page` stop at `maxBytes`, counting characters. `cell` returns the whole value.
- `apply` keeps all changes or none. It fails with `read-only` on a read only connection, `unsupported` on a view, `no-row-key` without a row key, `conflict` (with `change`) when a key matches zero or several rows, and `query-failed` for a duplicate primary key. Omitted values take their default, including auto increment and `CURRENT_TIMESTAMP`.
- `execute` and `page` run `SELECT * FROM <table>` on the selected schema, the first until a call names another. Any other statement fails with `unsupported` and ends the list.
- `transaction` toggles the flag `execute` reports as `inTransaction`. A rollback does not undo a change.
- `discover` answers the `containers` option.
- `export`, `sample` and `import` fail with `unsupported`. To test an app's dialogs, answer them in a wrapping client or transport.
- `cancel` answers a request still waiting out `latencyMs` with `cancelled`.

## Limits

- `where` and `orderBy` are ignored: `rows` and `count` return every row in stored order.
- Any SQL beyond `SELECT * FROM <table>` fails, including the designer's `ALTER TABLE` and the explorer's `DROP TABLE`.
- Inserts enforce only the primary key. Other indexes and foreign keys are only reported.

For anything that depends on SQL, such as an error's exact text, use the real helper against a SQLite file.

## In a test

```tsx
import { UIProvider } from '@adecore/ui';
import { createDatabaseClient, DatabaseProvider, TableView } from '@adecore/database';
import { fakeDatabaseTransport } from '@adecore/database/testing';

const client = createDatabaseClient(fakeDatabaseTransport({ databases: { '/data/shop.sqlite': shop } }));

render(
    <UIProvider i18n={i18n}>
        <DatabaseProvider client={client}>
            <TableView connection={{ id: 'shop', name: 'Shop', config: { engine: 'sqlite', path: '/data/shop.sqlite' } }} schema="main" table="customers" />
        </DatabaseProvider>
    </UIProvider>
);
```
