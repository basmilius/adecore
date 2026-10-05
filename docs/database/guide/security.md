# Security

The page of a desktop app can open a connection to a database and run SQL on it. That is the point of the package, and it is also a lot of power to hand to a renderer. This page lists what the host checks, what it leaves to the app and which parts are raw SQL by design.

## The host is the boundary

The page is not trusted. Whatever reaches `host.handle` may have been written by code you did not ship, such as a script injected into a page. The host treats it that way in three ways: it checks the shape of a request, it keeps sessions apart by owner, and it distrusts the helper's answers too.

### Shape

`host.handle(request, owner)` takes `unknown` and checks it with `parseRequest` before anything reaches the helper. A request must have exactly the keys of its method, with the right types:

- An unknown key is refused, so a typo cannot pass for an option the helper ignores.
- Ids are strings of 1 to 200 characters. Limits are integers, `limit` from 1 to 10000 and `cellLimit` from 1 to 1048576. `offset` is a safe non-negative integer.
- The path of a SQLite connection is absolute. A relative path would resolve against the helper's working directory.
- A binary value is lowercase hex of whole bytes, and a number is finite.
- A change that updates or deletes names at least one column of the key.

A request that fails any of this comes back as `invalid-request`, with a message that says which field. The helper never sees it.

### Owners

The app passes an owner with every request: a window, a socket, a tab. A session belongs to the owner that opened it. Another owner that sends the session's id gets `unknown-session`, and a `cancel` from another owner cancels nothing. When an owner goes away, `host.release(owner)` cancels its requests and closes its sessions. Two owners can use the same request ids without clashing.

### The helper's answers

The host reads what the helper writes and turns anything that is not a response of the protocol into an `internal` error. A helper from another release, with another `PROTOCOL_VERSION`, is refused at the first line it writes.

## What the app must do

The host registers no channel and listens to no event. The app owns both ends of the check:

1. Check the sender before calling `host.handle`. In Electron, that is the origin of `event.senderFrame` against the page you loaded, as for any other IPC channel that does something sensitive. In a server, it is the authentication of the WebSocket upgrade.
2. Name the owner so that one window cannot reach another's sessions, and call `release` when it goes away. See [Getting started](/database/guide/getting-started#wire-the-host).
3. Decide which connections may be opened. Without a check, a page can open any SQLite file the helper's user can read and any server the machine can reach.

## Restricting connections

`authorize` is asked on every `open` and `test`, with the connection and the owner. Return `false` and the request fails with `forbidden` before the helper starts. An `authorize` that throws or rejects counts as `false`. When you leave `authorize` out, every connection is allowed.

Only files under a folder:

```ts
import { relative, resolve } from 'node:path';

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath),
    authorize(connection) {
        if (connection.engine !== 'sqlite') {
            return false;
        }

        const inside = relative(dataFolder, resolve(connection.path));
        return !inside.startsWith('..') && connection.create !== true;
    }
});
```

Only a server on this machine:

```ts
const LOCAL = new Set(['localhost', '127.0.0.1', '::1']);

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath),
    authorize: (connection) => connection.engine === 'mysql' && connection.socket === undefined && LOCAL.has(connection.host)
});
```

The connection reaches `authorize` after its shape is checked, and it carries the password. Do not log it. Think about `create` (a SQLite connection that makes the file) and `socket` (a MySQL connection through a Unix socket instead of `host`) when you decide what is allowed.

If the app lets people type a host, a MySQL connection is a way to reach whatever the machine can reach. A desktop app that connects to the person's own servers is fine with that. A server that runs the host for many people is not, and `authorize` is where to say so.

## Read-only connections

`readOnly: true` on a connection is enforced in the helper, not in the views:

- SQLite opens the file read-only and sets `PRAGMA query_only`.
- MySQL and MariaDB start the session with `SET SESSION TRANSACTION READ ONLY`.
- `apply` fails with `read-only`, and so does a statement the server refuses on a read-only session.

The views also disable their edit actions and say why. On MySQL the setting is a session variable, so SQL typed in a [`QueryConsole`](/database/views/query-console) can change it back. For a guarantee, connect with an account that only has `SELECT` on the schema.

## `where` and `orderBy` are SQL

The `rows` and `count` methods take `where` and `orderBy` as SQL text, the way a person types them after those keywords in a table view. They reach the server as written, inside one statement. That is by design: it is the filter box of a database tool, and a person who can type a filter can already run any query in the console.

What this means for you:

- Do not build a `where` from input of a third party. There is no parameter binding for it.
- The helper builds one `SELECT`, with `where` in parentheses and `orderBy` after it, and sends it as one statement. Treat both as a filter and a sort, not as a way to run other statements.
- Neither is a way around a read-only connection, which stays read only.
- `execute` runs any SQL the person types, several statements at a time. It can do whatever the account of the connection can do. Give that account only what the person should be able to do.

Schema, table and column names in the other methods are quoted by the helper, not interpolated as given.

## Passwords

The package stores nothing. A `Connection` is a plain object the app keeps, and its `config` holds the password as typed. Where to put it is a decision for the app:

- Keep the password out of the saved list and fetch it from the operating system's keychain when a connection opens, for example with Electron's `safeStorage`.
- Do not log requests. The `open` and `test` requests carry the password.
- The helper's stderr goes to `onLog` of `spawnHelper`. Write it to your log as diagnostics, not as data.

`ConnectionManager` and `ConnectionForm` call `onValueChange` with the whole connection on every edit. Splitting the password off before saving is the app's job.
