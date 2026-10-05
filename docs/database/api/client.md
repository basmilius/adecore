# Client

The client is what the views talk to, and what an app talks to when it wants data without a view. It turns the calls of a [`DatabaseSession`](#databasesession) into [protocol](/database/guide/protocol) requests, sends them through a transport and gives back the results or a [`DatabaseRequestError`](#errors).

```ts
import { createDatabaseClient, DatabaseRequestError, useDatabaseClient } from '@adecore/database';
```

## createDatabaseClient

```ts
const client = createDatabaseClient(transport, { createId });
```

`transport` is a `DatabaseTransport`: `(request: DatabaseRequest) => Promise<DatabaseResponse>`. It carries the request to the host and resolves with the response. It rejects only when the channel itself failed, and the client turns that into a `helper-unavailable` error.

```ts
const transport: DatabaseTransport = (request) => window.database.request(request);
```

`DatabaseClientOptions` has one field, `createId`, which makes the id of a request. It uses `crypto.randomUUID()` when left out. Pass your own in a test to get stable ids.

The client has four methods:

| Method | |
| --- | --- |
| `session(connection)` | The session of a `Connection`. The same object on every call. |
| `test(config, options?)` | Opens a connection and closes it again. Resolves with the `ServerInfo`. |
| `disconnect(connectionId)` | Closes the session of that connection. |
| `dispose()` | Closes every session. |

`session` is cheap. It connects on the first request, not when you call it. Calling it again with the same `id` and an equal `config` returns the same session, and updates its `name`. A connection whose `config` changed gets a new session, and the old one closes. This is how editing a connection in a [`ConnectionManager`](/database/views/connection-manager) makes the open views reconnect.

`useDatabaseClient()` reads the client of the nearest [`DatabaseProvider`](/database/guide/getting-started#mount-the-page) in a component. It throws without one.

## DatabaseSession

One open connection.

```ts
const session = client.session(connection);

const info = await session.server();
const tables = await session.tables('main');
const page = await session.rows('main', 'customers', { offset: 0, limit: 100, where: "country = 'NL'", orderBy: 'name' });
```

| Method | Resolves with |
| --- | --- |
| `server(options?)` | `ServerInfo`: the flavor and version. Opens the connection if it is not open. |
| `schemas(options?)` | `readonly SchemaInfo[]` |
| `tables(schema, options?)` | `readonly TableInfo[]` |
| `structure(schema, table, options?)` | `TableStructure` |
| `rows(schema, table, query, options?)` | `RowsResult` for a `RowsQuery` |
| `count(schema, table, where?, options?)` | The number of rows, as a number |
| `cell(schema, table, key, column, options?)` | The whole `Value` of one cell |
| `apply(schema, table, changes, options?)` | The number of rows affected |
| `execute(sql, options?)` | `readonly StatementResult[]` |
| `close()` | Closes the session |

`session.connection` is the `Connection` it was made for.

`RowsQuery` is `{ offset, limit, where?, orderBy?, cellLimit? }`. `TableRef` names a table in a connection by `connectionId`, `schema` and `table`, for code that passes tables around. Every method but `close` takes `RequestOptions` last, which is `{ signal? }`. `ExecuteOptions` adds `schema`, `limit` and `cellLimit` to those.

## Retry rules

The host can lose a session without the page knowing: the helper exited, or crashed, and its sessions went with it. The next request then fails with `unknown-session`. The session handles that, but only where it is safe:

- A read (`schemas`, `tables`, `structure`, `rows`, `count`, `cell`) opens the connection again and is sent once more. Sending a read twice does no harm.
- A write (`apply`) and `execute` are not sent again. The session forgets the lost connection, so the next call opens a new one, and this call fails with `unknown-session`. Nobody can tell whether a write ran before the helper died.
- A second `unknown-session` on the retry of a read is passed on.

Concurrent calls on a closed session share one `open`. If it fails, the next call tries again.

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

| Field | |
| --- | --- |
| `code` | A `DatabaseErrorCode`, such as `query-failed` or `conflict`. |
| `message` | The sentence from the server, the helper or the host. |
| `sqlState` | The five characters of SQLSTATE, or `undefined`. |
| `change` | For `conflict`, which change of an `apply` failed, counted from zero. Otherwise `undefined`. |

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
