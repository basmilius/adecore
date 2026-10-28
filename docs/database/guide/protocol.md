# Protocol

The page, the host and the helper speak one protocol of JSON messages. `@adecore/database/protocol` holds its types and pure helpers and imports nothing, so a page, a preload and a backend can all use it.

```ts
import { PROTOCOL_VERSION, valueOfCell, type DatabaseRequest, type DatabaseResponse } from '@adecore/database/protocol';
```

A request carries an `id`, which its response repeats and a `cancel` names:

```json
{
    "id": "r4",
    "method": "rows",
    "params": { "session": "s1", "schema": "main", "table": "users", "where": "id > 1", "orderBy": "email DESC", "offset": 0, "limit": 2, "cellLimit": 16 }
}
```

```json
{
    "id": "r4",
    "ok": true,
    "result": {
        "columns": [
            { "name": "id", "type": "INTEGER", "kind": "integer" },
            { "name": "email", "type": "TEXT", "kind": "text" }
        ],
        "rows": [
            [3, "zoe@example.com"],
            [2, { "kind": "longText", "preview": "a.very.long.addr", "length": 41 }]
        ],
        "hasMore": true,
        "elapsedMs": 0.4
    }
}
```

A failed request answers with `ok: false` and an error:

```json
{ "id": "r9", "ok": false, "error": { "code": "conflict", "message": "The change matched no row.", "change": 2 } }
```

`DatabaseMethods` maps each method to its params and its result. `DatabaseRequest<M>`, `DatabaseResponse<M>`, `DatabaseMethod`, `DatabaseParams<M>` and `DatabaseResult<M>` read from it.

## Methods

A session is what `open` returns. Every method except `open`, `test`, `sample`, `discover` and `cancel` names one in `session`.

| Method        | Params                                                                              | Result                       |
| ------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| `open`        | `connection`                                                                        | `{ session, server }`        |
| `close`       | `session`                                                                           | `null`                       |
| `test`        | `connection`                                                                        | `{ server }`                 |
| `schemas`     | `session`                                                                           | `{ schemas }`                |
| `tables`      | `session`, `schema`                                                                 | `{ tables }`                 |
| `structure`   | `session`, `schema`, `table`                                                        | `TableStructure`             |
| `rows`        | `session`, `schema`, `table`, `offset`, `limit`, `where?`, `orderBy?`, `cellLimit?` | `RowsResult`                 |
| `count`       | `session`, `schema`, `table`, `where?`                                              | `{ count }`                  |
| `cell`        | `session`, `schema`, `table`, `key`, `column`                                       | `{ value }`                  |
| `apply`       | `session`, `schema`, `table`, `changes`                                             | `{ affected }`               |
| `execute`     | `session`, `sql`, `schema?`, `limit?`, `cellLimit?`                                 | `{ results, inTransaction }` |
| `page`        | `session`, `sql`, `offset`, `limit`, `schema?`, `cellLimit?`                        | `RowsResult`                 |
| `transaction` | `session`, `action`                                                                 | `{ active }`                 |
| `export`      | `session`, `source`, `format`, `path`, `header?`, `tableName?`                      | `{ rows, bytes, elapsedMs }` |
| `sample`      | `path`, `format`, `header`, `limit?`                                                | `{ columns, rows }`          |
| `import`      | `session`, `schema`, `table`, `path`, `format`, `header`, `columns`                 | `{ rows, elapsedMs }`        |
| `discover`    | `kind`, `context?`                                                                  | `{ containers }`             |
| `cancel`      | `request`                                                                           | `{ cancelled }`              |

- `open` and `test` take a [`ConnectionConfig`](#connections) and report a `ServerInfo`: the `flavor` (`sqlite`, `mysql` or `mariadb`) and the server's `version`. `test` closes the connection again.
- `schemas` lists `SchemaInfo`: a `name`, and `system` for a schema the server keeps for itself. A schema is a MySQL database; SQLite has `main` and one per attached file.
- `tables` lists `TableInfo`: the `name`, the `kind` (a `TableKind`, `table` or `view`), a `rowEstimate` from server statistics (rough, or `null`) and the `comment`.
- `structure` returns a `TableStructure`: `ColumnInfo`, `IndexInfo` and `ForeignKeyInfo` lists, the `primaryKey`, the `rowKey` and the `ddl`. The `rowKey` is the primary key, else the first unique index over non-null columns. Without one it is `null` and the table is read only. A table also has `triggers`, `TriggerInfo` with `name`, `timing` (`BEFORE`, `AFTER` or `INSTEAD OF`) and `event` (`INSERT`, `UPDATE` or `DELETE`). On MySQL and MariaDB it has `checks`, `CheckInfo` with `name` and the `expression` without `CHECK` and parentheses. A view has neither field. SQLite tables and MySQL servers before 8.0.16 have no `checks`.
- `rows` returns one page: the `ResultColumn` list, rows of `Cell` values, `hasMore` and `elapsedMs`. `limit` is at most 10000. `cellLimit` is the characters of text, or bytes of binary, a cell holds before it becomes a preview, 1024 by default.
- `maxBytes` bounds the JSON size of a response's rows: 8388608 (8 MiB) by default, at most 67108864. Rows stop before the one that would pass it and `hasMore` is true, so a page can hold fewer rows than `limit`. Start the next page at `offset` plus the rows received. The first row of a result always comes, so paging always advances.
- `where` and `orderBy` are SQL as typed after those keywords. See [Security](/database/guide/security#where-and-orderby-are-sql).
- `count` counts the rows that match `where`.
- `cell` returns the whole `Value` of one cell. `key` is a `RowKey`: the row key's columns with their values.
- `apply` runs a list of `RowChange` values in one transaction. An `insert` has `values`, an `update` has a `key` and `values`, a `delete` has a `key`. A value is an `EditValue`: a `Value`, or `{ kind: 'default' }` for the column default, which SQLite takes only in an insert. An update or delete that matches zero or several rows rolls everything back and fails with `conflict`, with the zero-based index in `change`.
- `execute` runs one or more statements separated by semicolons and answers one `StatementResult` per statement: `rows`, `done` (with `affected` and `lastInsertId`) or `error`. A failed statement ends the list. `limit` is the rows per result, 500 by default and at most 10000. `cellLimit` defaults to 65536. `maxBytes` covers all statements together. `schema` is selected first and stays selected for the session. `inTransaction` says whether a transaction is open afterwards. On MySQL a `LIMIT` in a statement overrides `limit`.
- `cancel` stops the request with that id and answers whether it was still running. That request fails with `cancelled`, except an `execute` that had begun. It answers its `results` up to the stopped statement, an `error` with code `cancelled`, and the real `inTransaction`, so completed writes and open transactions stay visible.

A `ResultColumn` of `rows`, `page` and `execute` has a `name`, the engine's `type`, its `kind`, and a `source` (a `ColumnSource` of `schema`, `table` and `column`) when the server names the table column it holds. An expression column has none. SQLite looks through views and subqueries to the table. MariaDB names a derived table as a table, and a view as the view.

### Reading a result in pages

`page` returns one page of a single reading statement, so a console can read past its first page. The statement must start with `SELECT` or `WITH`; anything else, including several statements, fails with `unsupported`. A page keeps the statement's order on every engine. `cellLimit` defaults to 65536, and `maxBytes` works as for `rows`.

### Transactions

`transaction` takes `begin`, `commit` or `rollback` and answers whether a transaction is open afterwards. Beginning while one is open, or ending none, changes nothing. While one is open, `execute` runs in it, and `apply` and `import` run as a savepoint inside it. Closing the session rolls back an open transaction. `execute` also notices SQL that begins or ends a transaction itself.

### Files

`export`, `sample` and `import` name a file by an absolute `path` on the helper's machine. The host asks the app first; see [Files](/database/guide/files).

- `export` streams every row of a `source`, an `ExportSource`, to a file: a table (`{ kind: 'table', schema, table, where?, orderBy? }`) or one reading statement (`{ kind: 'query', sql, schema? }`). The `format` is a `FileFormat`: `csv`, `tsv`, `json` or `sql`. `header` (default true) puts column names on the first line of CSV and TSV. `tableName` names the table in the `INSERT` statements of `sql`. See the [formats](/database/guide/files#exporting).
- `sample` reads the first `limit` lines (default 20) of a CSV or TSV file. It answers the column names, or `column1` to `columnN` without a header, and the rows as strings, short lines padded with empty strings.
- `import` inserts the lines of a CSV or TSV file in one transaction. `columns` has one entry per field: the target column, or `null` to skip it. An empty field or `\N` becomes NULL.

### Discovering containers

`discover` with `kind: 'docker'` lists running containers that look like database servers: an image name with `mysql`, `mariadb` or `percona`, or an exposed 3306. `context` picks another Docker context. Without Docker or a running daemon it fails with `unsupported`.

Each entry is a `DockerContainer`:

| Field                 |                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `name`, `image` | As `docker ps` shows them.                                                                                                                                                                                   |
| `engine`              | What the image or its ports suggest (`mysql` for MySQL and MariaDB), or `null`.                                                                                                                              |
| `ports`               | The ports inside the container, each with the host port it is published on, or `null`.                                                                                                                       |
| `project`, `service`  | From the Compose labels, or `null`.                                                                                                                                                                          |
| `suggested`           | `user`, `password` and `database` from the environment: `MYSQL_USER`, `MYSQL_PASSWORD` and `MYSQL_DATABASE` or their `MARIADB_` variants, else `root` with `MYSQL_ROOT_PASSWORD` or `MARIADB_ROOT_PASSWORD`. |

## Values

A `Value` is `null`, a boolean, a number, a string or a `BinaryValue` (`{ kind: 'binary', hex }`, lowercase hex). Integers beyond `Number.MAX_SAFE_INTEGER`, decimals, dates and times arrive as the server's text.

A `Cell` is a `Value` when it fits the cell limit. Otherwise it is a `LongTextCell` (`{ kind: 'longText', preview, length }`, length in characters) or a `BinaryCell` (`{ kind: 'binary', hex, length }`, length in bytes). `valueOfCell(cell)` returns the `Value` for a row key or update, or `undefined` for a preview.

`ValueKind` classifies a value across engines: `integer`, `decimal`, `float`, `boolean`, `text`, `binary`, `date`, `time`, `datetime`, `json` or `other`.

## Connections

A `ConnectionConfig` is a `SqliteConnectionConfig` or a `MysqlConnectionConfig`, and `Engine` is their `engine`. See [Connections](/database/guide/connections).

| Field              | SQLite                                  | MySQL or MariaDB                                                                                            |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `engine`           | `'sqlite'`                              | `'mysql'`                                                                                                   |
| `path`             | The absolute path of the file           |                                                                                                             |
| `create`           | Creates the file when it does not exist |                                                                                                             |
| `host`             |                                         | The server's host name, as the far end of a tunnel sees it. Ignored, and may be empty, with a Docker tunnel |
| `port`             |                                         | 3306 when left out                                                                                          |
| `socket`           |                                         | A Unix socket instead of `host` and `port`. A tunnel overrides it                                           |
| `user`, `password` |                                         | The account                                                                                                 |
| `database`         |                                         | The schema a session starts in. Without it a session sees every schema and has none selected                |
| `tls`              |                                         | A `MysqlTlsMode`: `disable`, `prefer` (the default), `require` or `verify`                                  |
| `tunnel`           |                                         | A `Tunnel`: an `SshTunnel` or a `DockerTunnel`                                                              |
| `readOnly`         | Opens the connection read only          | Opens the connection read only                                                                              |

| Tunnel                            | Fields                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `SshTunnel` (`kind: 'ssh'`)       | `host` (a host name or a `Host` of `~/.ssh/config`), `port?`, `user?`, `identityFile?`        |
| `DockerTunnel` (`kind: 'docker'`) | `container` (a name or an id), `port?` (inside the container, 3306 when left out), `context?` |

A tunnel lives as long as its session, and a MySQL `cancel` uses it too.

## Error codes

A `DatabaseError` has a `code` (a `DatabaseErrorCode`), a `message`, the five-character `sqlState` when the server sent one, and the `change` of a `conflict`. The client raises it as a [`DatabaseRequestError`](/database/api/client#errors).

| Code                 | Sent by              | Meaning                                                                                                                                                           |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-request`    | Host, helper         | The request does not have the shape of the protocol, or its id is already running.                                                                                |
| `unknown-session`    | Host, helper         | The session was closed, belongs to another owner, belonged to a helper that has exited, or lost its connection to the server.                                     |
| `connect-failed`     | Helper               | The server or the file could not be reached or opened.                                                                                                            |
| `auth-failed`        | Helper               | The server turned the credentials down.                                                                                                                           |
| `tunnel-failed`      | Helper               | The SSH or Docker tunnel did not come up. `message` holds what `ssh` or `docker` said.                                                                            |
| `query-failed`       | Helper               | The server turned the SQL down. `sqlState` and `message` say why.                                                                                                 |
| `read-only`          | Helper               | A write on a connection opened read only, an import included.                                                                                                     |
| `no-row-key`         | Helper               | An update or a delete on a table without a row key.                                                                                                               |
| `conflict`           | Helper               | An update or a delete matched no row or more than one, so the transaction was rolled back.                                                                        |
| `cancelled`          | Helper, host, client | The request was cancelled.                                                                                                                                        |
| `unsupported`        | Helper               | The engine cannot do what was asked, such as a statement `page` cannot wrap, or `discover` without Docker.                                                        |
| `file-failed`        | Helper               | A file could not be read or written, or a line of it is broken.                                                                                                   |
| `forbidden`          | Host                 | `authorize`, `authorizeFile` or `authorizeDiscovery` turned the request down.                                                                                     |
| `helper-exited`      | Host                 | The helper exited while the request was running.                                                                                                                  |
| `helper-unavailable` | Host, client         | The helper could not be started, did not become ready, speaks another protocol version or could not be written to. The client uses it when the transport rejects. |
| `internal`           | Host, helper         | Something the protocol does not describe went wrong.                                                                                                              |

## The helper's wire

The host talks to the helper over its standard streams, one JSON message per line. A test can speak the same wire to the binary directly.

- Before it reads a request, the helper writes a ready line: `{"event":"ready","protocol":5,"version":"0.1.0"}`. `protocol` is its `PROTOCOL_VERSION` and `version` its release.
- The host stops a helper whose `protocol` differs from its own, or that sends no ready line within `readyTimeoutMs` (10000 by default). The request that started it fails with `helper-unavailable`.
- Then one request per line on stdin and one response per line on stdout. Empty lines are ignored. An invalid line gets `invalid-request`, with its id when readable.
- Requests run concurrently, so responses can arrive out of order; the `id` matches them. Requests on one session queue in arrival order on its single connection.
- When a MySQL or MariaDB session loses its connection (killed, `wait_timeout`, a dropped tunnel), the session ends. The request that hit it and every request queued behind it answer `unknown-session`.
- `cancel` interrupts the statement on SQLite and runs `KILL QUERY` from a second connection on MySQL. The cancelled request answers `cancelled`, except a completed write, which answers its result, and an `execute` that had begun.
- stderr carries log lines for people, outside the protocol. `spawnHelper` hands each to `onLog`.
- A line can be megabytes, such as a page of rows with long cells.
- When stdin closes, the helper gives running requests up to two seconds, cancels the rest, rolls back open transactions, closes its sessions and exits with code 0.

The host renames each request id for the helper (`h1`, `h2`, ...) and restores the page's id on the response, so two owners can use the same ids.

## Versions

`PROTOCOL_VERSION` is `5`. It rises whenever a message changes shape, so a host refuses a helper of another release instead of misreading it. Each release ships a matching host and helper. An app that ships its own helper rebuilds it when it updates the package.
