# Protocol

The page, the host and the helper speak one protocol of JSON messages. `@adecore/database/protocol` holds its types and imports nothing else, so a page, a preload and a backend can all read it.

```ts
import { PROTOCOL_VERSION, valueOfCell, type DatabaseRequest, type DatabaseResponse } from '@adecore/database/protocol';
```

A request names its own `id`, which its response repeats and a `cancel` points at:

```json
{ "id": "r4", "method": "rows", "params": { "session": "s1", "schema": "main", "table": "users", "where": "id > 1", "orderBy": "email DESC", "offset": 0, "limit": 2, "cellLimit": 16 } }
```

```json
{ "id": "r4", "ok": true, "result": {
    "columns": [{ "name": "id", "type": "INTEGER", "kind": "integer" }, { "name": "email", "type": "TEXT", "kind": "text" }],
    "rows": [[3, "zoe@example.com"], [2, { "kind": "longText", "preview": "a.very.long.addr", "length": 41 }]],
    "hasMore": true,
    "elapsedMs": 0.4 } }
```

A failed request answers with `ok: false` and an error instead:

```json
{ "id": "r9", "ok": false, "error": { "code": "conflict", "message": "The update matched no row.", "change": 2 } }
```

`DatabaseRequest<M>` and `DatabaseResponse<M>` are the two shapes, `DatabaseMethods` maps each method to its params and result, and `DatabaseMethod`, `DatabaseParams<M>` and `DatabaseResult<M>` read from it.

## Methods

A session is what `open` returns. Every method but `open`, `test` and `cancel` names one in `session`.

| Method | Params | Result |
| --- | --- | --- |
| `open` | `connection` | `{ session, server }` |
| `close` | `session` | `null` |
| `test` | `connection` | `{ server }` |
| `schemas` | `session` | `{ schemas }` |
| `tables` | `session`, `schema` | `{ tables }` |
| `structure` | `session`, `schema`, `table` | `TableStructure` |
| `rows` | `session`, `schema`, `table`, `offset`, `limit`, `where?`, `orderBy?`, `cellLimit?` | `RowsResult` |
| `count` | `session`, `schema`, `table`, `where?` | `{ count }` |
| `cell` | `session`, `schema`, `table`, `key`, `column` | `{ value }` |
| `apply` | `session`, `schema`, `table`, `changes` | `{ affected }` |
| `execute` | `session`, `sql`, `schema?`, `limit?`, `cellLimit?` | `{ results }` |
| `cancel` | `request` | `{ cancelled }` |

- `open` connects with a `ConnectionConfig` and answers with the session id and a `ServerInfo`: the `flavor` (`sqlite`, `mysql` or `mariadb`) and the version the server reports. `test` opens a connection and closes it again, for a form that checks what a person filled in.
- `schemas` lists `SchemaInfo`: a name and whether the server keeps it for itself (`system`). A schema is a database in MySQL terms. SQLite has `main` and one per attached file.
- `tables` lists `TableInfo`: the name, the `kind` (a `TableKind`: `table` or `view`), a `rowEstimate` from the server's statistics (which can be far off, or `null`) and the comment.
- `structure` returns a `TableStructure` with its `ColumnInfo`, `IndexInfo` and `ForeignKeyInfo` lists, the `primaryKey`, the `rowKey` and the `ddl`. The `rowKey` is the primary key, or else the first unique index over columns that cannot be null. When it is `null`, the table is read only.
- `rows` returns one page as a `RowsResult`: the `ResultColumn` list, the rows of `Cell` values, `hasMore` and `elapsedMs`. `limit` is at most 10000. `cellLimit` counts characters of text or bytes of a binary value before a cell becomes a preview, and is 1024 when left out. The helper reads one row more than the limit to learn `hasMore`.
- `where` and `orderBy` are SQL as a person types it after those keywords. See [Security](/database/guide/security#where-and-orderby-are-sql).
- `count` counts the rows that match `where`. It is a separate request because on a big table it is slow.
- `cell` returns the whole `Value` of one cell, for a cell that a read cut off. The `key` is a `RowKey`: the columns of the row key and their values.
- `apply` takes a list of `RowChange` values and runs them in one transaction, so all of them apply or none does. An `insert` has `values`, an `update` has a `key` and `values`, and a `delete` has a `key`. A value in an insert or an update is an `EditValue`: a `Value`, or `{ kind: 'default' }` to set the column to its default. An update or a delete that matches no row or more than one rolls everything back and fails with `conflict`, and `change` says which change it was, counted from zero.
- `execute` runs one statement or several, separated by semicolons, and answers with one `StatementResult` per statement: `rows` for a result set, `done` for a statement that changed something (with `affected` and `lastInsertId`) or `error`. A failed statement ends the list, and the ones after it never ran. `limit` is the rows per result, at most 10000 and 500 when left out. `cellLimit` is 65536 when left out. `schema` switches to that schema first, and it stays selected for the session.
- `cancel` stops the request with that id. It answers whether the request was still running, and the request itself fails with `cancelled`.

## Values

Every value crosses as JSON. A `Value` is `null`, a boolean, a number, a string or a `BinaryValue` (`{ kind: 'binary', hex }`, lowercase hex). An integer beyond `Number.MAX_SAFE_INTEGER`, a decimal, a date and a time arrive as the text the server writes for them.

A `Cell` is what a result holds. It is a `Value` when it fits the cell limit, and when it does not it is a `LongTextCell` (`{ kind: 'longText', preview, length }`, the length in characters) or a `BinaryCell` (`{ kind: 'binary', hex, length }`, the length in bytes of the whole value). `valueOfCell(cell)` returns the `Value` a row key or an update can use, or `undefined` when the cell is only a preview.

`ValueKind` says what a value is, independent of the engine's name for its type, so a grid can align and edit it: `integer`, `decimal`, `float`, `boolean`, `text`, `binary`, `date`, `time`, `datetime`, `json` or `other`.

## Connections

A `ConnectionConfig` is a `SqliteConnectionConfig` or a `MysqlConnectionConfig`. `Engine` is the union of their `engine` values.

| Field | SQLite | MySQL or MariaDB |
| --- | --- | --- |
| `engine` | `'sqlite'` | `'mysql'` |
| `path` | An absolute path to the file | |
| `create` | Create the file when it does not exist | |
| `host` | | The server's host name |
| `port` | | 3306 when left out |
| `socket` | | A Unix socket, instead of `host` and `port` |
| `user`, `password` | | The account |
| `database` | | The schema a session starts in. Without it a session sees every schema and has none selected |
| `tls` | | An `MysqlTlsMode` |
| `readOnly` | Open the connection read only | Open the connection read only |

A `MysqlTlsMode` is `disable`, `prefer`, `require` or `verify`. `prefer` falls back to plain text when the server offers no TLS. `verify` also checks the certificate against the host name.

## Error codes

A `DatabaseError` has a `code` (a `DatabaseErrorCode`), a `message`, the five characters of the `sqlState` when the server sent them, and for `conflict` the `change` that failed. The client raises it as a [`DatabaseRequestError`](/database/api/client#errors).

| Code | Sent by | Meaning |
| --- | --- | --- |
| `invalid-request` | Host, helper | The request does not have the shape of the protocol, or its id is already running. |
| `unknown-session` | Host, helper | The session was closed, belonged to another owner, or belonged to a helper that has since exited. |
| `connect-failed` | Helper | The server or file could not be reached or opened. |
| `auth-failed` | Helper | The server turned the credentials down. |
| `query-failed` | Helper | The server turned the SQL down. `sqlState` and `message` say why. |
| `read-only` | Helper | A write on a connection opened read only. |
| `no-row-key` | Helper | An update or a delete on a table without a primary key or a unique key over columns that cannot be null. |
| `conflict` | Helper | An update or a delete matched no row or more than one, so the transaction was rolled back. |
| `cancelled` | Helper, host, client | The request was cancelled. |
| `unsupported` | Helper | The engine cannot do what was asked. |
| `forbidden` | Host | The app's `authorize` turned the connection down. |
| `helper-exited` | Host | The helper exited while the request was running. |
| `helper-unavailable` | Host, client | The helper could not be started, did not become ready, speaks another protocol version or could not be written to. The client also uses it when the transport itself rejects. |
| `internal` | Host, helper | Something the protocol does not describe went wrong. |

## The helper's wire

The host starts the helper with `spawnHelper(path)` and talks to it over its standard streams, as newline-delimited JSON. Anything else can speak the same wire, such as a test that starts the binary by hand.

- The first line the helper writes on stdout is the ready line, before it reads a request: `{"event":"ready","protocol":1,"version":"0.1.0"}`. `protocol` is `PROTOCOL_VERSION` and `version` is the helper's own release (`HelperReady`).
- The host reads the ready line and compares `protocol` with its own `PROTOCOL_VERSION`. A helper from another release is stopped, and the request that started it fails with `helper-unavailable`. The default wait for the line is 10 seconds (`readyTimeoutMs`).
- After that, one request per line on stdin and one response per line on stdout. Requests run concurrently, so responses can come in another order. The `id` matches them. An empty line is ignored.
- stderr holds logs for a person to read, one per line. It is not part of the protocol. `spawnHelper` passes each line to `onLog`.
- A line can be megabytes: a page of rows with long cells is one line.
- When stdin closes, the helper lets the requests in flight finish for up to two seconds, closes its sessions and exits.

The host does not pass the page's ids on. It sends each request to the helper under an id of its own (`h1`, `h2`, ...) and puts the page's id back on the response, so two owners can use the same ids.

## `PROTOCOL_VERSION`

`PROTOCOL_VERSION` is a number, `1` today. It rises whenever a message changes shape, so a host refuses a helper from another release instead of misreading it. A release of the package ships a host and a helper that agree. If your app ships the helper binary on its own schedule, rebuild it when you update the package.
