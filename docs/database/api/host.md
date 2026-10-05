# Host

The host runs in the app's backend, under Bun or Node. It sits between the channel the app already has and the helper process, and it is the boundary a page cannot get around. It imports nothing from React.

```ts
import { createDatabaseHost, helperPath, parseRequest, spawnHelper } from '@adecore/database/host';
import type { DatabaseHost, DatabaseHostOptions, HelperPathOptions, HelperProcess, ParsedRequest, SpawnHelperOptions } from '@adecore/database/host';
```

## createDatabaseHost

```ts
const host = createDatabaseHost({
    start: () => spawnHelper(path),
    authorize: (connection, owner) => isAllowed(connection, owner),
    authorizeFile: (path, access, owner) => isChosen(path, access, owner),
    authorizeDiscovery: (kind, owner) => isTrusted(owner),
    readyTimeoutMs: 10000
});
```

`DatabaseHostOptions`:

| Option               |                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`              | `() => HelperProcess`. Starts a helper. Called on the first request, and again on the first request after one exited.                                                                    |
| `authorize`          | `(connection, owner) => boolean \| Promise<boolean>`. Asked on every `open` and `test`. Optional; every connection is allowed without it.                                                |
| `authorizeFile`      | `(path, access, owner) => boolean \| Promise<boolean>`. Asked on every `export` (`'write'`), and every `import` and `sample` (`'read'`). Optional, but every file is refused without it. |
| `authorizeDiscovery` | `(kind, owner) => boolean \| Promise<boolean>`. Asked on every `discover`. Optional, but discovery is refused without it, since it hands container credentials to the page.              |
| `readyTimeoutMs`     | How long to wait for the helper's ready line. 10000 when left out.                                                                                                                       |

A check that returns `false`, throws or rejects turns the request down with `forbidden`, before the helper starts or sees it. Which checks to write, and what each one protects, is the subject of [Security](/database/guide/security).

The host registers no channel and listens to no event. The app checks the sender, then calls `handle`.

### DatabaseHost

| Method                   |                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `handle(request, owner)` | Takes what came over the channel, as it is, and resolves with a `DatabaseResponse`. It never rejects.               |
| `release(owner)`         | Cancels the requests of an owner that went away and closes its sessions.                                            |
| `dispose()`              | Releases every owner and stops the helper. A host that is disposed answers every request with `helper-unavailable`. |

`handle` takes `unknown` on purpose. It validates the request with [`parseRequest`](#parserequest) before anything else, so a page can send whatever it likes and the helper only sees well-formed requests.

`owner` is a string the app picks: a window id, a socket id. The host keeps these rules:

- A session belongs to the owner that opened it. Another owner using its id gets `unknown-session`.
- A `cancel` only reaches the requests of the owner that sent it.
- Two requests of one owner that are running at once cannot share an id. The second fails with `invalid-request`.
- Request ids are the owner's. The host sends the helper ids of its own and writes the owner's id back on the response.

`release` and `dispose` wait for the helper to answer its `close` requests for up to two seconds, so a helper that hangs cannot hold up an app that quits.

### Failures of the helper

The helper starts lazily and is expected to stay up. When it does not:

- If it exits while requests are running, they fail with `helper-exited`. Its sessions are gone, and the host forgets them. The next request starts a new helper.
- If `start` throws, if the helper does not write its ready line within `readyTimeoutMs`, if the line is not a ready line or if it names another `PROTOCOL_VERSION`, the request that started it fails with `helper-unavailable`.
- If the helper writes something that is not a response of the protocol, that request fails with `internal`.

The [client](/database/api/client#retry-rules) opens a session again after `unknown-session` where that is safe.

### HelperProcess

`HelperProcess` is a running helper as the host sees it: lines in, lines out. [`spawnHelper`](#spawnhelper) makes one from a path. You can write your own, such as a fake in a test of the host:

| Member             |                                              |
| ------------------ | -------------------------------------------- |
| `write(line)`      | Sends one message, without its line break.   |
| `onLine(listener)` | Hears each line the helper writes to stdout. |
| `onExit(listener)` | Hears the exit code, or `null`.              |
| `kill()`           | Stops the process.                           |

## spawnHelper

```ts
const helper = spawnHelper(path, { args, env, onLog });
```

Runs the helper binary at `path` and speaks one JSON message per line over its stdin and stdout. It returns a `HelperProcess`, which is what `start` must return.

`SpawnHelperOptions`:

| Option  |                                                 |
| ------- | ----------------------------------------------- |
| `args`  | Arguments for the binary. None by default.      |
| `env`   | Added over the environment of this process.     |
| `onLog` | Receives each line the helper writes to stderr. |

Lines are cut at `\n`, and a trailing `\r` is dropped. A line can be megabytes, and cutting one stays linear. A path that cannot be run ends in `onExit` with `null`, after `onLog` hears the reason, so the host answers with `helper-unavailable`. The helper is a separate build for each platform, so the path comes from [`helperPath`](#helperpath) or from a binary the app ships itself.

## helperPath

```ts
const path = helperPath();
```

Finds the prebuilt helper that the package manager installed for this machine. `@adecore/database` lists one package per platform as an optional dependency (`@adecore/database-darwin-arm64` for Apple silicon, `-linux-x64`, `-linux-arm64` and `-win32-x64`), and the manager installs the one that fits. `helperPath` returns the path of its binary, or `null` when the platform has no package or the install left optional dependencies out.

```ts
const path = helperPath();

if (path === null) {
    throw new Error('No prebuilt helper for this platform.');
}

const host = createDatabaseHost({ start: () => spawnHelper(path) });
```

A binary cannot run from inside an Electron `app.asar` archive. `helperPath` maps `app.asar` to `app.asar.unpacked`, so the app has to unpack the platform packages; see [Getting started](/database/guide/getting-started#package-the-helper).

`HelperPathOptions` exists for tests, and each field has a default:

| Option     |                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------- |
| `platform` | `process.platform`.                                                                         |
| `arch`     | `process.arch`.                                                                             |
| `resolve`  | Resolves a package specifier to a file. The module resolution of the package when left out. |
| `exists`   | Whether a path exists. `fs.existsSync` when left out.                                       |

## parseRequest

```ts
const parsed = parseRequest(input);

if (parsed.ok) {
    parsed.request; // a DatabaseRequest
} else {
    parsed.id; // the request's id, or '' when it had none
    parsed.error; // { code: 'invalid-request', message }
}
```

`parseRequest(input: unknown)` checks the whole envelope and the params of its method and returns a `ParsedRequest`. `handle` calls it for you. Use it directly when you route requests yourself, for example to log or rate limit by method before they reach the host. It returns `{ ok: true, request }` or `{ ok: false, id, error }`. The rules are listed under [Security](/database/guide/security#the-host-is-the-boundary).
