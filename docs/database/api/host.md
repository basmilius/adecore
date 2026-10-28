# Host

The host runs in the app's backend, under Bun or Node, between the app's channel and the helper. It is the boundary a page cannot bypass, and it imports nothing from React.

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
    authorizeDiscovery: (kind, owner) => isTrusted(owner)
});
```

`DatabaseHostOptions`:

| Option               | Type                                                   | Default                  |                                                                                            |
| -------------------- | ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| `start`              | `() => HelperProcess`                                  |                          | Required. Starts a helper on the first request, and again after one exited. |
| `authorize`          | `(connection, owner) => boolean \| Promise<boolean>`   | every connection allowed | Called on every `open` and `test`. |
| `authorizeFile`      | `(path, access, owner) => boolean \| Promise<boolean>` | every file refused       | Called on every `export` (`'write'`), `sample` and `import` (`'read'`). |
| `authorizeDiscovery` | `(kind, owner) => boolean \| Promise<boolean>`         | discovery refused        | Called on every `discover`, which hands container credentials to the page. |
| `readyTimeoutMs`     | `number`                                               | `10000`                  | How long to wait for the helper's ready line. |

A check that returns `false`, throws or rejects fails the request with `forbidden` before the helper sees it. See [Security](/database/guide/security).

### DatabaseHost

| Method                   |                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `handle(request, owner)` | Takes what came over the channel and resolves with a `DatabaseResponse`. Never rejects.                     |
| `release(owner)`         | Cancels an owner's running requests and closes its sessions. |
| `dispose()`              | Releases every owner and stops the helper. Later requests get `helper-unavailable`. |

`handle` takes `unknown` and checks it with [`parseRequest`](#parserequest) first, so the helper only sees well-formed requests. `owner` is a string the app picks, such as a window or socket id:

- A session belongs to the owner that opened it. Another owner using its id gets `unknown-session`.
- A `cancel` only reaches the sender's own requests.
- Two running requests of one owner cannot share an id; the second fails with `invalid-request`.
- Request ids belong to the owner. The host renames them for the helper and restores them on the response.

`release` and `dispose` wait at most two seconds for the helper, so a hung helper cannot block quitting.

### When the helper fails

- If the helper exits while requests run, they fail with `helper-exited` and its sessions are gone. The next request starts a new helper, and the [client](/database/api/client#retry-rules) reopens sessions where safe.
- If `start` throws, or the helper sends no valid ready line within `readyTimeoutMs`, or reports another `PROTOCOL_VERSION`, the request that started it fails with `helper-unavailable`.
- If the helper answers with something that is not a protocol response, that request fails with `internal`.

### HelperProcess

A running helper as the host sees it: lines in, lines out. [`spawnHelper`](#spawnhelper) makes one from a path, and a host test can write a fake.

| Member             |                                              |
| ------------------ | -------------------------------------------- |
| `write(line)`      | Sends one message, without its line break.   |
| `onLine(listener)` | Hears each line the helper writes to stdout. |
| `onExit(listener)` | Receives `(code, signal)`, each `null` when absent. |
| `kill()`           | Stops the process.                           |

## spawnHelper

```ts
const helper = spawnHelper(path, { args, env, onLog });
```

Runs the helper binary at `path` and returns a `HelperProcess`.

`SpawnHelperOptions`:

| Option  | Type                               |                                                       |
| ------- | ---------------------------------- | ----------------------------------------------------- |
| `args`  | `readonly string[]`                | Arguments for the binary. None by default.            |
| `env`   | `Readonly<Record<string, string>>` | Variables added over the environment of this process. |
| `onLog` | `(line: string) => void`           | Hears each line the helper writes to stderr.          |

A path that cannot run calls `onLog` with the reason and `onExit` with `(null, null)`, so the host answers `helper-unavailable`. An exit listener added after the exit still receives the code and signal. The signal tells a crash from an intentional stop such as `SIGTERM`. A custom `HelperProcess` may omit it, so treat `undefined` as unknown.

## helperPath

```ts
const path = helperPath();

if (path === null) {
    throw new Error('No prebuilt helper for this platform.');
}

const host = createDatabaseHost({ start: () => spawnHelper(path) });
```

Finds the helper for this machine, or returns `null`. It looks in this order:

1. `ADECORE_DATABASE_HELPER`, returned unchecked, so a wrong path fails at start instead of running another build.
2. The installed platform package (`@adecore/database-<platform>-<arch>`), with `app.asar` mapped to `app.asar.unpacked`; see [Getting started](/database/guide/getting-started#package-the-helper).
3. The release build in a linked checkout (`helper/target/release/adecore-database`), when the package runs from its `src`.

For a binary packaged elsewhere, pass its path to `spawnHelper`.

`HelperPathOptions` is for tests:

| Option     | Default                              |                                          |
| ---------- | ------------------------------------ | ---------------------------------------- |
| `platform` | `process.platform`                   |                                          |
| `arch`     | `process.arch`                       |                                          |
| `env`      | `process.env`                        | Where `ADECORE_DATABASE_HELPER` is read. |
| `resolve`  | the module resolution of the package | Resolves a package specifier to a file.  |
| `exists`   | `fs.existsSync`                      | Whether a path exists.                   |

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

Checks the envelope and the method's params and returns a `ParsedRequest`. `handle` calls it; call it yourself to route, log or rate limit requests first. [Security](/database/guide/security#shape) lists the rules.
