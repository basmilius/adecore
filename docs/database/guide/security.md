# Security

The page of a desktop app can open a connection to a database and run SQL on it. That is the point of the package, and it is also a lot of power to hand to a renderer. This page lists what the host checks, what it leaves to the app and which parts are raw SQL by design.

## The host is the boundary

The page is not trusted. Whatever reaches `host.handle` may have been written by code you did not ship, such as a script injected into a page. The host treats it that way in three ways: it checks the shape of a request, it keeps sessions apart by owner, and it distrusts the helper's answers too.

### Shape

`host.handle(request, owner)` takes `unknown` and checks it with `parseRequest` before anything reaches the helper. A request must have exactly the keys of its method, with the right types:

- An unknown key is refused, so a typo cannot pass for an option the helper ignores.
- Ids are strings of 1 to 200 characters. Limits are integers, `limit` from 1 to 10000 and `cellLimit` from 1 to 1048576. `offset` is a safe non-negative integer.
- The path of a SQLite connection, and the path of a file to export to, import from or sample, is absolute. A relative path would resolve against the helper's working directory.
- A tunnel is an SSH or a Docker tunnel with the fields of its kind, and a format is one the method takes.
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
3. Decide which connections may be opened. Without a check, a page can open any SQLite file the helper's user can read and any server the machine can reach, through any SSH host or Docker container it can see.
4. Decide which files the page may export to and import from. Without a check, every file is refused. See [Files](#files).
5. Decide whether the page may look for Docker containers. Without a check, discovery is refused. See [Discovery](#discovery).

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

The connection reaches `authorize` after its shape is checked, and it carries the password. Do not log it. Think about `create` (a SQLite connection that makes the file), `socket` (a MySQL connection through a Unix socket instead of `host`) and `tunnel` when you decide what is allowed.

A tunnel widens what a connection reaches. An SSH tunnel logs the helper into any `Host` of the person's `~/.ssh/config` or any machine its key opens, and then connects from there. A Docker tunnel talks to the Docker daemon the helper's user can reach, including the one a `context` names, and with no published port it runs `docker exec` in the container. A check that only looks at `host` is no check for those. Refuse the tunnels the app does not offer:

```ts
const host = createDatabaseHost({
    start: () => spawnHelper(helperPath),
    authorize: (connection) => connection.engine !== 'mysql' || connection.tunnel === undefined || connection.tunnel.kind === 'docker'
});
```

If the app lets people type a host, a MySQL connection is a way to reach whatever the machine can reach. A desktop app that connects to the person's own servers is fine with that. A server that runs the host for many people is not, and `authorize` is where to say so.

## Discovery

`discover` lists the running containers that look like database servers, and each entry carries `suggested` credentials read from the container's environment, passwords included. The page gets them so a form can fill itself in. That is the point, and it is also a way for a script in the page to read the root password of every database container on the machine.

`authorizeDiscovery(kind, owner)` is asked on every `discover`. Like the file check, it refuses when you leave the option out, since the credentials are the app's to hand over. A desktop app that connects to the person's own containers passes `authorizeDiscovery: () => true`, or a check of the owner. An app that does not offer the Docker mode, and an app that runs the host for people who must not see the machine's containers, leaves it out. The page then gets `forbidden`, and the form says why.

## Files

`export`, `sample` and `import` name a path, and the page chooses the string. `authorizeFile(path, access, owner)` is asked on every one of them, with `'write'` for an export and `'read'` for a sample and an import. Without it every file request fails with `forbidden`.

- The shape check has refused a path that is not absolute by then. It does not follow symbolic links, normalize `..` or look at the extension; that is the check's job.
- A write replaces an existing file when the export succeeds. A path in a startup folder or a shell profile is a way to run code later.
- A read tells the page the first lines of the file. A path that holds a secret is a way to read it, if the file happens to parse as CSV.
- The helper's own user does the reading and writing.

The safe rule is to allow exactly the paths the person picked in a dialog the app showed. [Files](/database/guide/files#allowing-a-path) has that check written out.

## Read-only connections

`readOnly: true` on a connection is enforced in the helper, not in the views:

- SQLite opens the file read-only and sets `PRAGMA query_only`.
- MySQL and MariaDB start the session with `SET SESSION TRANSACTION READ ONLY`.
- `apply` and `import` fail with `read-only`, and so does a statement the server refuses on a read-only session.

The views also disable their edit actions and say why, and the explorer and the designer leave out the items that write. On MySQL the setting is a session variable, so SQL typed in a [`QueryConsole`](/database/views/query-console) can change it back. For a guarantee, connect with an account that only has `SELECT` on the schema.

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
- `discover` answers with passwords from the environment of containers; see [Discovery](#discovery). A connection made from a container carries that password in its config, so it follows the same rule as any other: the app decides where it is stored.
- An SSH tunnel never asks for a password or a passphrase, so none is stored for it. It uses the key or the agent of the person who runs the app.

`ConnectionManager` and `ConnectionForm` call `onValueChange` with the whole connection on every edit. Splitting the password off before saving is the app's job.
