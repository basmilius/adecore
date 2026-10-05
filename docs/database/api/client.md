# Client

The client is what the views talk to, and what an app talks to when it wants data without a view. It turns the calls of a [`DatabaseSession`](#databasesession) into [protocol](/database/guide/protocol) requests, sends them through a transport and gives back the results or a [`DatabaseRequestError`](#errors).

```ts
import { createDatabaseClient, DatabaseRequestError, useDatabaseClient } from '@adecore/database';
import type { Connection, DatabaseClient, DatabaseSession, DatabaseTransport, SchemaChange } from '@adecore/database';
```

## createDatabaseClient

```ts
const client = createDatabaseClient(transport, { createId });
```

It returns a `DatabaseClient`. `transport` is a `DatabaseTransport`: `(request: DatabaseRequest) => Promise<DatabaseResponse>`. It carries the request to the host and resolves with the response. It rejects only when the channel itself failed, and the client turns that into a `helper-unavailable` error.

```ts
const transport: DatabaseTransport = (request) => window.database.request(request);
```

`DatabaseClientOptions` has one field, `createId`, which makes the id of a request. It uses `crypto.randomUUID()` when left out. Pass your own in a test to get stable ids.

The client has these methods:

| Method                                   |                                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `session(connection, channel?)`          | The session of a `Connection` on a channel (`''` when left out). The same object on every call.                                    |
| `test(config, options?)`                 | Opens a connection and closes it again. Resolves with the `ServerInfo`.                                                            |
| `discover('docker', options?)`           | The running containers that look like database servers, as `readonly DockerContainer[]`. `options.context` picks a Docker context. |
| `sample(path, format, header, options?)` | The first lines of a CSV or TSV file: `{ columns, rows }`, all strings.                                                            |
| `notifySchemaChange(change)`             | Tells the listeners that the shape of a database changed.                                                                          |
| `onSchemaChange(listener)`               | Calls the listener on every schema change. Returns the function that stops listening.                                              |
| `disconnect(connectionId)`               | Closes every session of that connection, on every channel.                                                                         |
| `dispose()`                              | Closes every session.                                                                                                              |

`discover` and `sample` need no connection. The host asks the app before it answers either; see [Security](/database/guide/security#discovery).

`session` is cheap. It connects on the first request, not when you call it. Calling it again with the same `id` and an equal `config` returns the same session, and updates its `name`. A connection whose `config` changed gets a new session, and the old one closes. This is how editing a connection in a [`ConnectionManager`](/database/views/connection-manager) makes the open views reconnect.

A channel is a second key next to the connection id. Each channel is a session of its own on the host, with its own connection and its own transaction, so work on one never lands inside another's transaction. The views share the default channel; a [`QueryConsole`](/database/views/query-console#transactions) takes a channel of its own and closes its session when it unmounts. An app that runs something long, or that lets a person hold a transaction open, asks for its own channel: `client.session(connection, 'import')`.

`useDatabaseClient()` reads the client of the nearest [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) in a component. It throws without one.

## DatabaseSession

One open connection.

```ts
const session = client.session(connection);

const info = await session.server();
const tables = await session.tables('main');
const page = await session.rows('main', 'customers', { offset: 0, limit: 100, where: "country = 'NL'", orderBy: 'name' });
```

| Method                                       | Resolves with                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `server(options?)`                           | `ServerInfo`: the flavor and version. Opens the connection if it is not open. |
| `schemas(options?)`                          | `readonly SchemaInfo[]`                                                       |
| `tables(schema, options?)`                   | `readonly TableInfo[]`                                                        |
| `structure(schema, table, options?)`         | `TableStructure`                                                              |
| `rows(schema, table, query, options?)`       | `RowsResult` for a `RowsQuery`                                                |
| `count(schema, table, where?, options?)`     | The number of rows, as a number                                               |
| `cell(schema, table, key, column, options?)` | The whole `Value` of one cell                                                 |
| `apply(schema, table, changes, options?)`    | The number of rows affected                                                   |
| `execute(sql, options?)`                     | `ExecuteResult`: the `results` of the statements and `inTransaction`          |
| `page(sql, query, options?)`                 | `RowsResult` for a `PageQuery`                                                |
| `transaction(action, options?)`              | Whether a transaction is open after `'begin'`, `'commit'` or `'rollback'`     |
| `export(request, options?)`                  | `ExportResult`: `rows`, `bytes` and `elapsedMs`                               |
| `import(schema, table, request, options?)`   | The number of rows inserted, for an `ImportRequest`                           |
| `close()`                                    | Closes the session                                                            |

`session.connection` is the `Connection` it was made for.

`RowsQuery` is `{ offset, limit, where?, orderBy?, cellLimit? }`. `PageQuery` is `{ offset, limit, schema?, cellLimit? }`. `TableRef` names a table in a connection by `connectionId`, `schema` and `table`, for code that passes tables around. Every method but `close` takes `RequestOptions` last, which is `{ signal? }`. `ExecuteOptions` adds `schema`, `limit` and `cellLimit` to those.

`page` fetches one page of one statement that reads, for a result larger than the first page `execute` returns; see [the protocol](/database/guide/protocol#reading-a-result-in-pages). `transaction` starts or ends a transaction the person drives, and `execute` reports the state afterwards in `inTransaction`; see [Transactions](/database/guide/protocol#transactions).

An `ExportRequest` is `{ source, format, path, header?, tableName? }` with an `ExportSource` and a `FileFormat`, and an `ImportRequest` is `{ path, format, header, columns }`. Both are described in [Files](/database/guide/files).

```ts
const { rows } = await session.export({
    source: { kind: 'query', sql: 'SELECT * FROM orders', schema: 'main' },
    format: 'csv',
    path: '/Users/me/Downloads/orders.csv'
});
```

## Retry rules

The host can lose a session without the page knowing: the helper exited, or crashed, and its sessions went with it. The next request then fails with `unknown-session`. The session handles that, but only where it is safe:

- A read (`schemas`, `tables`, `structure`, `rows`, `count`, `cell`, `page`) opens the connection again and is sent once more. Sending a read twice does no harm.
- A write (`apply`, `import`, `export`) and `execute` and `transaction` are not sent again. The session forgets the lost connection, so the next call opens a new one, and this call fails with `unknown-session`. Nobody can tell whether a write ran before the helper died.
- A second `unknown-session` on the retry of a read is passed on.

Concurrent calls on a closed session share one `open`. If it fails, the next call tries again.

## Schema changes

A tree that lists tables, or a view that shows a structure, goes stale when something creates, alters or drops. The client keeps the listeners that want to hear about it.

```ts
const stop = client.onSchemaChange((change) => {
    if (change.connectionId === connection.id) {
        reloadTables(change.schema);
    }
});
```

A `SchemaChange` is a `connectionId` and a `schema`. `schema` is `undefined` when the statement did not say which schema, and a listener then reloads every schema of the connection.

The client announces a change itself after an `execute` in which a statement succeeded that starts with `CREATE`, `ALTER`, `DROP`, `RENAME` or `TRUNCATE` (comments before it do not count). A view that changes the shape another way calls `client.notifySchemaChange({ connectionId, schema })`. A listener that throws is logged and does not keep the others from hearing the change. [`DatabaseExplorer`](/database/views/explorer), [`StructureView`](/database/views/structure-view), [`TableView`](/database/views/table-view) and [`TableDesigner`](/database/views/table-designer) listen.

## Abort and cancel

Every method takes an `AbortSignal` through its options. Aborting does two things: the call rejects at once with a `DatabaseRequestError` with code `cancelled`, and the client sends a `cancel` request for it, so the server stops the work. A signal that is aborted before the call rejects without sending anything.

```ts
const controller = new AbortController();
const counting = session.count('main', 'orders', "status = 'pending'", { signal: controller.signal });

controller.abort();
await counting.catch((error) => error instanceof DatabaseRequestError && error.code === 'cancelled');
```

The host only cancels requests of the owner that sent them.

## Errors

A request that fails rejects with a `DatabaseRequestError`, an `Error` with the code of the protocol.

| Field      |                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------- |
| `code`     | A `DatabaseErrorCode`, such as `query-failed` or `conflict`.                                 |
| `message`  | The sentence from the server, the helper or the host.                                        |
| `sqlState` | The five characters of SQLSTATE, or `undefined`.                                             |
| `change`   | For `conflict`, which change of an `apply` failed, counted from zero. Otherwise `undefined`. |

```ts
try {
    await session.apply('main', 'orders', [{ kind: 'update', key: { id: 3 }, values: { status: 'shipped' } }]);
} catch (error) {
    if (error instanceof DatabaseRequestError && error.code === 'conflict') {
        showMessage(`Change ${error.change! + 1} matched no row or more than one.`);
    }
}
```

The codes are listed in the [protocol](/database/guide/protocol#error-codes). A transport that rejects, or resolves with something that is not a response, becomes `helper-unavailable`.

## Closing

`session.close()` and `client.disconnect(id)` close the connection on the server and forget it here. They never reject. `client.dispose()` does that for every session, for when a page goes away.
