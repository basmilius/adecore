# Testing

`@adecore/database/testing` has a transport that answers the whole protocol from memory. The demos on this site run on it, and an app can run its tests or its Storybook on it without a helper or a server.

```ts
import { fakeDatabaseTransport, type FakeDatabase, type FakeDatabaseTransportOptions, type FakeTable } from '@adecore/database/testing';
```

## fakeDatabaseTransport

```ts
const client = createDatabaseClient(
    fakeDatabaseTransport({
        databases: { '/data/shop.sqlite': shop },
        latencyMs: 150
    })
);
```

It returns a `DatabaseTransport`, so it goes wherever the real one goes: `createDatabaseClient`, and then a `DatabaseProvider`.

`FakeDatabaseTransportOptions`:

| Option | |
| --- | --- |
| `databases` | The data, keyed by the `path` of a SQLite connection or the `host` of a MySQL one. A connection to a key that is not here fails with `connect-failed`. |
| `latencyMs` | Delays every answer. A `cancel` for a request that is still waiting answers it with `cancelled`. |
| `server` | The `ServerInfo` every `open` and `test` reports. Derived from the engine when left out. |

The transport works on a copy of the data, so what you pass in never changes, and each transport starts from it. Edits made through `apply` live as long as the transport.

## The data

A `FakeDatabase` is `{ schemas }`: schema name to table name to a `FakeTable`. SQLite uses the schema `main`.

A `FakeTable` has:

| Field | |
| --- | --- |
| `columns` | The `ColumnInfo` list. |
| `rows` | One entry per row, its `Value`s in the order of `columns`. |
| `primaryKey` | Also the row key. A table without one, and without a unique index, is read only. |
| `kind` | `table` when left out. A view cannot be edited. |
| `indexes`, `foreignKeys` | What `structure` reports. |
| `ddl` | The `CREATE` statement `structure` reports. |

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

The fake follows the protocol, including its failures:

- `open`, `test`, `close`, `schemas`, `tables` and `structure` answer from the data. The schemas `information_schema`, `mysql`, `performance_schema` and `sys` are marked `system`.
- `rows` pages with `offset` and `limit`, reports `hasMore` and cuts text and bytes at `cellLimit` into previews. `cell` returns the whole value.
- `apply` runs insert, update and delete as one unit: if a change fails, none is kept. It fails with `read-only` on a read only connection, `unsupported` on a view, `no-row-key` without a row key and `conflict` (with `change`) when a key matches no row or more than one. A missing value takes its default, with auto increment numbering and `CURRENT_TIMESTAMP`.
- `cancel` answers `cancelled: true` for a request that is still waiting out `latencyMs`.

## Limits

It is a fake, not an engine:

- `where` and `orderBy` are not interpreted. `rows` and `count` return every row in stored order.
- `execute` only runs `SELECT * FROM <table>`, on the selected schema (the first one until a call names another). Every other statement answers with an `unsupported` error, and as in the protocol the first failed statement ends the list.
- Indexes, foreign keys and uniqueness are reported by `structure` but only the primary key is enforced on insert.

Use the real helper against a SQLite file for anything that depends on SQL, such as the exact text of an error.

## In a test

```tsx
import { createDatabaseClient, DatabaseProvider, TableView } from '@adecore/database';
import { fakeDatabaseTransport } from '@adecore/database/testing';

const client = createDatabaseClient(fakeDatabaseTransport({ databases: { '/data/shop.sqlite': shop } }));

render(
    <UIProvider i18n={i18n}>
        <DatabaseProvider client={client}>
            <TableView connection={connection} schema="main" table="customers" />
        </DatabaseProvider>
    </UIProvider>
);
```
