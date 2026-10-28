# Client

The views talk to the client, and an app can use it for data without a view. It turns [`DatabaseSession`](#databasesession) calls into [protocol](/database/guide/protocol) requests, sends them through a transport and resolves with the results, or rejects with a [`DatabaseRequestError`](#errors).

```ts
import { createDatabaseClient, DatabaseRequestError, useDatabaseClient } from '@adecore/database';
import type { Connection, DatabaseClient, DatabaseSession, DatabaseTransport, SchemaChange } from '@adecore/database';
```

## createDatabaseClient

```ts
const client = createDatabaseClient((request) => window.database.request(request));
```

The first argument is a `DatabaseTransport`, `(request: DatabaseRequest) => Promise<DatabaseResponse>`. When it rejects, the call fails with `helper-unavailable`.

The second argument is a `DatabaseClientOptions` with one field, `createId`, which makes request ids. It defaults to `crypto.randomUUID()`; pass your own in a test for stable ids.

| Method                                   |                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `session(connection, channel?)`          | The session of a `Connection` on a channel, `''` when left out. The same object on every call.    |
| `test(config, options?)`                 | Opens a connection and closes it again. Resolves with the `ServerInfo`.                           |
| `discover('docker', options?)`           | The running containers that look like database servers. `options.context` picks a Docker context. |
| `sample(path, format, header, options?)` | The first lines of a CSV or TSV file, as `{ columns, rows }` of strings.                          |
| `notifySchemaChange(change)`             | Tells the listeners that the shape of a database changed.                                         |
| `onSchemaChange(listener)`               | Calls the listener on every schema change. Returns the function that stops listening.             |
| `disconnect(connectionId)`               | Closes every session of that connection, on every channel.                                        |
| `dispose()`                              | Closes every session.                                                                             |

`session` connects on the first request. With the same `id` and an equal `config`, it returns the same session and takes the new `name`. A changed `config` gets a new session and closes the old one, so open views reconnect after an edit.

A channel is a second key beside the connection id, with its own connection and transaction on the host. The views share the default channel, and each [`QueryConsole`](/database/views/query-console#transactions) takes its own. An app that holds a transaction open takes its own too: `client.session(connection, 'import')`.

`useDatabaseClient()` reads the client of the nearest [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), and throws without one.

## DatabaseSession

One open connection. `session.connection` is its `Connection`.

```ts
const session = client.session(connection);

const tables = await session.tables('main');
const page = await session.rows('main', 'customers', { offset: 0, limit: 100, where: "country = 'NL'", orderBy: 'name' });
```

| Method                                       | Resolves with                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `server(options?)`                           | The `ServerInfo`. Opens the connection if it is not open.                                    |
| `schemas(options?)`                          | `readonly SchemaInfo[]`                                                                      |
| `tables(schema, options?)`                   | `readonly TableInfo[]`                                                                       |
| `structure(schema, table, options?)`         | `TableStructure`                                                                             |
| `rows(schema, table, query, options?)`       | `RowsResult` for a `RowsQuery`: `{ offset, limit, where?, orderBy?, cellLimit?, maxBytes? }` |
| `count(schema, table, where?, options?)`     | The number of rows                                                                           |
| `cell(schema, table, key, column, options?)` | The whole `Value` of one cell                                                                |
| `apply(schema, table, changes, options?)`    | The number of rows affected                                                                  |
| `execute(sql, options?)`                     | `ExecuteResult`: `results`, one per statement, and `inTransaction`                           |
| `page(sql, query, options?)`                 | `RowsResult` for a `PageQuery`: `{ offset, limit, schema?, cellLimit?, maxBytes? }`          |
| `transaction(action, options?)`              | Whether a transaction is open after `'begin'`, `'commit'` or `'rollback'`                    |
| `export(request, options?)`                  | `ExportResult`: `rows`, `bytes` and `elapsedMs`                                              |
| `import(schema, table, request, options?)`   | The number of rows inserted                                                                  |
| `close()`                                    | Nothing. Closes the session.                                                                 |

Every method but `close` takes `RequestOptions` (`{ signal? }`) last; `ExecuteOptions` adds `schema`, `limit`, `cellLimit` and `maxBytes`. [Methods](/database/guide/protocol#methods) describes each on the server. An `ExportRequest` is `{ source, format, path, header?, tableName? }` and an `ImportRequest` is `{ path, format, header, columns }`; see [Files](/database/guide/files). A `TableRef` names a table by `connectionId`, `schema` and `table`.

## Retry rules

A session ends when the helper exits or the server connection drops, and its next request gets `unknown-session`. The session retries only where safe:

- A read (`schemas`, `tables`, `structure`, `rows`, `count`, `cell` and `page`) reopens the connection and is sent once more.
- `apply`, `execute`, `transaction`, `export` and `import` are not resent, since nobody knows whether they ran. The call fails with `unknown-session`, and the next call reconnects.

Concurrent calls on a closed session share one `open`. When it fails, the next call tries again.

## Schema changes

When something creates, alters or drops, the client tells its listeners so trees and structures can reload:

```ts
const stop = client.onSchemaChange((change) => {
    if (change.connectionId === connection.id) {
        reloadTables(change.schema);
    }
});
```

A `SchemaChange` is a `connectionId` and a `schema`. An `undefined` schema means reload every schema of the connection.

The client announces a change itself after an `execute` with a successful `CREATE`, `ALTER`, `DROP`, `RENAME` or `TRUNCATE` statement. Code that changes the shape another way calls `client.notifySchemaChange({ connectionId, schema })`. A throwing listener is logged and does not block the others. [`DatabaseExplorer`](/database/views/explorer), [`StructureView`](/database/views/structure-view), [`TableView`](/database/views/table-view) and [`TableDesigner`](/database/views/table-designer) listen.

## Abort and cancel

Aborting a call's `signal` rejects it at once with code `cancelled` and sends a `cancel` request so the server stops. An already aborted signal rejects without sending anything.

An `execute` the helper already began waits for its answer instead. The results hold what ran before the cancel, end with an `error` of code `cancelled`, and report `inTransaction`, so a committed write or an open transaction stays visible. It still rejects with `cancelled` when nothing ran or the `cancel` could not be sent.

```ts
const controller = new AbortController();
const counting = session.count('main', 'orders', "status = 'pending'", { signal: controller.signal });

controller.abort();
await counting.catch((error) => error instanceof DatabaseRequestError && error.code === 'cancelled');
```

## Errors

A failed request rejects with a `DatabaseRequestError`, an `Error` with the fields of the protocol's `DatabaseError`:

| Field      |                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `code`     | A `DatabaseErrorCode`, such as `query-failed` or `conflict`. See [Error codes](/database/guide/protocol#error-codes). |
| `message`  | The sentence from the server, the helper or the host.                                                                 |
| `sqlState` | The five characters of SQLSTATE, or `undefined`.                                                                      |
| `change`   | For `conflict`, which change of an `apply` failed, counted from zero. Otherwise `undefined`.                          |

```ts
try {
    await session.apply('main', 'orders', [{ kind: 'update', key: { id: 3 }, values: { status: 'shipped' } }]);
} catch (error) {
    if (error instanceof DatabaseRequestError && error.code === 'conflict') {
        showMessage(`Change ${error.change! + 1} matched no row or more than one.`);
    }
}
```

## Closing

`session.close()` and `client.disconnect(id)` close the server connection and never reject. `client.dispose()` closes every session when the page goes away.
