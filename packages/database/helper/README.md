# adecore-database

The native helper of `@adecore/database`: a Rust binary that a host process spawns. It talks to SQLite files and MySQL or MariaDB servers on behalf of a database browser, so the host needs no driver of its own. This file is for people who work on the helper.

## Build and test

Rust 1.88 or newer (edition 2024) is required.

```sh
cargo build --release --locked      # target/release/adecore-database
cargo test                          # unit, fixture, SQLite and process tests
cargo fmt
cargo clippy --all-targets -- -D warnings
```

`Cargo.lock` is committed; build scripts pass `--locked`.

The MySQL tests return early unless `ADECORE_TEST_MYSQL_URL` is set, in the form `mysql://user:pass@host:port`. The user needs the right to create and drop schemas named `adecore_t_*`. To run them against throwaway servers:

```sh
docker run --rm -d --name adecore-test-mariadb -e MARIADB_ROOT_PASSWORD=test -p 33061:3306 mariadb:11
docker run --rm -d --name adecore-test-mysql -e MYSQL_ROOT_PASSWORD=test -p 33062:3306 mysql:8.4

ADECORE_TEST_MYSQL_URL=mysql://root:test@127.0.0.1:33061 cargo test --test mysql
ADECORE_TEST_MYSQL_URL=mysql://root:test@127.0.0.1:33062 cargo test --test mysql

docker rm -f adecore-test-mariadb adecore-test-mysql
```

The tests also adapt to a server without TLS: `require` is then expected to fail with `connect-failed`.

## Wire format

The contract lives in TypeScript, in `src/protocol` of the package, with shared examples in `fixtures/protocol`. `tests/fixtures.rs` reads every example, parses its request and round-trips its response through the Rust types, so a change on one side shows up on the other.

- Newline-delimited JSON on stdin and stdout, one message per line. Logs go to stderr only.
- The first line written is `{"event":"ready","protocol":1,"version":"<crate version>"}`.
- A request is `{"id", "method", "params"}`; the answer is `{"id", "ok": true, "result"}` or `{"id", "ok": false, "error": {"code", "message", "sqlState"?, "change"?}}`.
- A line that is not a valid request is answered with `invalid-request`, carrying the id when one could be read and an empty id otherwise.
- Requests run concurrently. Requests on one session run one after another, in the order they arrived, on the single connection of that session. `open`, `test` and `cancel` need no session.
- `cancel` points at the `id` of a request. SQLite interrupts the statement through its interrupt handle; MySQL runs `KILL QUERY` from a second connection with the same settings. The cancelled request answers `cancelled`, except an `apply` that already committed.
- When stdin ends, requests in flight get two seconds to answer, running queries are cancelled, every session is closed and the process exits with 0.

## Layout

- `protocol.rs`: the serde types and the request parser.
- `dispatcher.rs`: session registry, one worker task per session, cancellation.
- `engine.rs`: `Engine` and `Canceller`, which pick between the two backends.
- `sqlite.rs`, `mysql.rs`: the backends. SQLite runs on the blocking pool, MySQL on `mysql_async` with rustls.
- `sql.rs`: statements and the apply planner both backends share. `quoting.rs`, `splitter.rs`, `kinds.rs`, `cells.rs`: identifier quoting, the script splitter, the mapping from declared types to `ValueKind`, and cell encoding.

## Behavior worth knowing

- `where` and `orderBy` reach the server as written, inside one statement. Each is followed by a newline so a trailing `--` comment cannot swallow the rest. SQLite refuses a second statement when it prepares; MySQL refuses it because `rows` uses the prepared protocol.
- Integers outside the safe range of a JSON number cross as strings. Decimals, dates, times and datetimes cross as the server's text and are never cut to a preview; text and binary values are cut at `cellLimit`.
- The MySQL connection asks for found rows rather than changed rows, so an update that sets the same values still counts as a hit in `apply`.
- `execute` on MySQL sets `sql_select_limit` to the limit plus one for the whole script and restores the default afterwards. An explicit `LIMIT` in a statement overrides it.
- `tls: "verify"` checks the certificate against the bundled Mozilla roots and the host name. A server with a private certificate authority can only use `require`.

## Limits

- The splitter does not understand MySQL's client-side `DELIMITER`, so a stored routine with semicolons in its body cannot be sent through `execute`. SQLite trigger bodies are kept whole.
- Column defaults are normalized for MariaDB 10.2.7 and newer and for MySQL 8; older servers report them differently.
- Connections over a Unix socket are not covered by the tests.
