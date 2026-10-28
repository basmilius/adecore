# Getting started

Install the package, find the helper, wire the host into a backend and mount the views.

## Install

::: code-group

```sh [bun]
bun add @adecore/database
```

```sh [npm]
npm install @adecore/database
```

```sh [pnpm]
pnpm add @adecore/database
```

:::

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies of the page only. `@adecore/database/host` and `@adecore/database/protocol` import none of them. Set up [`@adecore/ui`](/ui/guide/getting-started) first.

## The helper

The helper, `adecore-database`, is a Rust program that holds the drivers. One optional dependency per platform carries it (`@adecore/database-darwin-arm64` for Apple silicon, `-linux-x64`, `-linux-arm64` and `-win32-x64`), and the package manager installs the matching one. `helperPath()` returns the path of its binary:

```ts
import { helperPath } from '@adecore/database/host';

const path = helperPath();

if (path === null) {
    throw new Error('No prebuilt helper for this platform.');
}
```

`null` means the platform has no package, or the install skipped optional dependencies. The Linux binaries need glibc 2.35 or newer. Set `ADECORE_DATABASE_HELPER` to another build's path to override it.

### Package the helper

A binary cannot run from inside `app.asar`. `helperPath()` maps `app.asar` to `app.asar.unpacked`, so unpack the platform packages. With electron-builder:

```json
{
    "asarUnpack": ["node_modules/@adecore/database-*/**"]
}
```

Sign the unpacked binary with the app. Copying it into `extraResources` and passing that path to `spawnHelper` works too.

### Build it yourself

For another platform or a patched helper, build it from a checkout and pass the path to `spawnHelper`:

```sh
cargo build --release --locked --manifest-path packages/database/helper/Cargo.toml
```

The binary lands in `packages/database/helper/target/release/adecore-database` (`.exe` on Windows) and needs no system library. An app that links the checkout gets this build from `helperPath()` when no platform package has a binary.

## Wire the host

Create one host per app, in the backend. It starts the helper on the first request, and again after the helper exits.

The app checks the sender of every request, then passes it to `host.handle(request, owner)`. `owner` names who is asking, such as a window or a socket, and owns the sessions it opens. Call `host.release(owner)` when the owner goes away, and `host.dispose()` when the app quits. `host.handle` never rejects. A failed request comes back with `ok: false` and an [error code](/database/guide/protocol#error-codes).

### Electron main process

```ts
import { app, ipcMain } from 'electron';
import { createDatabaseHost, helperPath, spawnHelper } from '@adecore/database/host';

const path = helperPath()!;
const host = createDatabaseHost({
    start: () => spawnHelper(path, { onLog: (line) => console.error(`[database] ${line}`) })
});

ipcMain.handle('database:request', (event, request: unknown) => {
    if (!isTrustedSender(event.senderFrame)) {
        throw new Error('Untrusted sender.');
    }

    return host.handle(request, String(event.sender.id));
});

app.on('web-contents-created', (_event, contents) => {
    const owner = String(contents.id);
    contents.once('destroyed', () => void host.release(owner));
});

app.on('before-quit', () => void host.dispose());
```

`isTrustedSender` is yours: compare the frame's origin with the page you loaded. A reloaded window keeps its owner and its old sessions until it closes. Call `host.release(owner)` on a main-frame navigation if that matters.

The host asks the app before it opens a connection, touches a file or lists containers, through `authorize`, `authorizeFile` and `authorizeDiscovery`. Without `authorizeFile`, export and import are refused. Without `authorizeDiscovery`, the form finds no Docker containers. See [Security](/database/guide/security).

### Electron utility process

A [utility process](https://www.electronjs.org/docs/latest/api/utility-process) keeps the helper's pipes and JSON work off the main process. The host runs in the worker, and the main process tags each request with a ticket to match the answer:

```ts
// database-worker.ts, forked with utilityProcess.fork
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';

const host = createDatabaseHost({ start: () => spawnHelper(process.env.ADECORE_DATABASE_HELPER!) });

process.parentPort.on('message', async ({ data }) => {
    if (data.release !== undefined) {
        await host.release(data.release);
        return;
    }

    process.parentPort.postMessage({ ticket: data.ticket, response: await host.handle(data.request, data.owner) });
});
```

```ts
// main.ts
const worker = utilityProcess.fork(join(__dirname, 'database-worker.js'), [], {
    env: { ...process.env, ADECORE_DATABASE_HELPER: helperPath()! }
});
const waiting = new Map<number, (response: unknown) => void>();
let ticket = 0;

worker.on('message', (message: { ticket: number; response: unknown }) => {
    waiting.get(message.ticket)?.(message.response);
    waiting.delete(message.ticket);
});

ipcMain.handle('database:request', (event, request: unknown) => {
    if (!isTrustedSender(event.senderFrame)) {
        throw new Error('Untrusted sender.');
    }

    return new Promise((resolve) => {
        waiting.set(++ticket, resolve);
        worker.postMessage({ ticket, owner: String(event.sender.id), request });
    });
});
```

Release an owner with `worker.postMessage({ release: owner })` when its window is destroyed.

### Bun or Node server

Over a WebSocket an owner is a socket. The server authenticates the upgrade, since the host knows no people.

```ts
import { createDatabaseHost, helperPath, spawnHelper } from '@adecore/database/host';

const path = helperPath()!;
const host = createDatabaseHost({ start: () => spawnHelper(path) });

Bun.serve<{ owner: string }>({
    fetch(request, server) {
        if (!isAuthenticated(request)) {
            return new Response('Forbidden', { status: 403 });
        }

        return server.upgrade(request, { data: { owner: crypto.randomUUID() } }) ? undefined : new Response('Expected a WebSocket', { status: 400 });
    },
    websocket: {
        async message(socket, message) {
            let request: unknown = null;

            try {
                request = JSON.parse(String(message));
            } catch {
                // handle() answers a request that is not one with `invalid-request`.
            }

            socket.send(JSON.stringify(await host.handle(request, socket.data.owner)));
        },
        close(socket) {
            void host.release(socket.data.owner);
        }
    }
});
```

## Expose the channel to the page

In Electron, the preload exposes one function. A preload can import `@adecore/database/protocol`, which holds only types and pure helpers:

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { DatabaseRequest, DatabaseResponse } from '@adecore/database/protocol';

contextBridge.exposeInMainWorld('database', {
    request: (request: DatabaseRequest): Promise<DatabaseResponse> => ipcRenderer.invoke('database:request', request)
});
```

Over a WebSocket, the transport matches each response to its request by `id`:

```ts
import type { DatabaseTransport } from '@adecore/database';
import type { DatabaseResponse } from '@adecore/database/protocol';

const socket = new WebSocket(url);
const waiting = new Map<string, (response: DatabaseResponse) => void>();

socket.onmessage = (event) => {
    const response = JSON.parse(event.data) as DatabaseResponse;
    waiting.get(response.id)?.(response);
    waiting.delete(response.id);
};

const transport: DatabaseTransport = (request) =>
    new Promise((resolve) => {
        waiting.set(request.id, resolve);
        socket.send(JSON.stringify(request));
    });
```

## Mount the page

Create the client once and mount `DatabaseProvider` inside `UIProvider`:

```tsx
import i18next from 'i18next';
import { createRoot } from 'react-dom/client';
import { UIProvider } from '@adecore/ui';
import { createDatabaseClient, DatabaseProvider } from '@adecore/database';

const client = createDatabaseClient((request) => window.database.request(request));

createRoot(document.getElementById('root')!).render(
    <UIProvider i18n={i18next} formatSource={formatSource}>
        <DatabaseProvider client={client}>
            <App />
        </DatabaseProvider>
    </UIProvider>
);
```

Call `client.dispose()` when the page goes away, to close its sessions. The views take a `Connection`, `{ id, name, config }`. The app keeps the list, [`ConnectionManager`](/database/views/connection-manager) edits it, and [Connections](/database/guide/connections) explains each `config`.

### DatabaseProvider

`DatabaseProvider` hands the client and the app's hooks to every view below it, and adds the package's words to the i18next instance of `UIProvider`. A view outside one throws. Your own components read the client with `useDatabaseClient()`.

| Prop             | Type                               | Default      |                                                                                                                                                                                 |
| ---------------- | ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client`         | `DatabaseClient`                   |              | Required on the outermost provider. A nested provider inherits what it leaves out; see [Nested providers](/database/guide/tabs#nested-providers). |
| `onAction`       | `(action: DatabaseAction) => void` |              | Where a table, a console or the designer opens. Without it the views hide the items that would open one. See [Opening tables as tabs](/database/guide/tabs). |
| `onNotice`       | `(notice: DatabaseNotice) => void` |              | Receives passing news, such as a finished export. Without it each view shows its own. See [Notices](#notices). |
| `storage`        | `DatabaseStorage`                  |              | Keeps what a person set. Without it the views start fresh every time. |
| `files`          | `DatabaseFiles`                    |              | The app's file dialogs. Without them there is no export or import. See [Files](/database/guide/files). |
| `numberNotation` | `NumberNotation`                   | `'database'` | How cells draw numbers. See [Number notation](#number-notation).                                                                                                                |
| `children`       | `ReactNode`                        |              | Required.                                                                                                                                                                       |

`DatabaseProviderProps` is an exported type.

### Notices

Passing news includes a finished or failed export or import, an unreadable file, and a failed page of results or transaction end. With `onNotice`, the views hand each to the app, such as for a toast, and show none themselves. Without it, each view shows its own above its content, with Dismiss.

A `DatabaseNotice` has a `tone` (`'success'` or `'error'`), a short `title`, a `description` with the server's or file system's message on failure, and an optional `action` of a `label` and `run()`.

```tsx
<DatabaseProvider client={client} onNotice={(notice) => toasts.show({ kind: notice.tone, title: notice.title, description: notice.description })}>
```

State of a view stays in the view: a submit conflict, why a table is read only, a changed table with Reload, a running export with Cancel, a failed apply in the designer, and the result of Test connection.

`DatabaseStorage` is `get(key)`, returning a string or `null`, and `set(key, value)`, where `null` removes the key. Both are synchronous, so `localStorage` fits:

```tsx
const storage: DatabaseStorage = {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => (value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value))
};
```

The views keep JSON under these keys and ignore values they do not recognize:

| Key                                               | What                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `database:explorer:<connection id>`               | The open nodes of the [explorer](/database/views/explorer)                                       |
| `database:table:<connection id>:<schema>.<table>` | The layout and filters of a [table view](/database/views/table-view#remembered-layout)           |
| `database:console-history:<connection id>`        | The history of a [console](/database/views/query-console#history)                                |
| `database:console-results`                        | The height of the results of every [console](/database/views/query-console#results), in pixels   |
| `database:record-view`                            | The width of the [record view](/database/views/table-view#record-view) beside a table, in pixels |
| `database:workbench`                              | The open tabs of a [workbench](/database/views/workbench)                                        |

### Number notation

`numberNotation` (type `NumberNotation`) sets how cells draw numbers. `'database'` draws the server's text: `12900.50` stays `12900.50`. `'region'` uses the [format source](/ui/formatting/) of `UIProvider` and keeps every digit: `12.900,50` in a Dutch region.

<Demo src="database/number-notation" />

Only the drawing changes. Editing, copying, filters, export and everything sent to the server keep the server's text. Row numbers, counts and selection sums follow the region either way.

### Keys the views take

A view that handles a key calls `preventDefault()` and lets it bubble. App shortcuts on the window should skip a key with `defaultPrevented` set, so Cmd+Shift+Enter in a console does not also trigger an app binding.

```ts
window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) {
        return;
    }

    runAppShortcut(event);
});
```

## Tailwind

The views use Tailwind classes. Let Tailwind scan the package next to `@adecore/ui`, relative to the CSS file:

```css
@import 'tailwindcss';
@import '@adecore/ui/theme.css';

@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/database/dist";
```

Without the second `@source` the views render unstyled.

## Words and languages

The words live in the `database` namespace (`DATABASE_NAMESPACE`), in English and Dutch. `DatabaseProvider` adds them, as does a [`DataGrid`](/database/views/data-grid) without one. Both skip a language that already has a `database` bundle.

To add a language, add its bundle before the provider mounts. `DATABASE_RESOURCES`, keyed by language code, holds the English source:

```ts
import { DATABASE_NAMESPACE } from '@adecore/database';

// `germanWords` has the same keys as DATABASE_RESOURCES.en.
i18next.addResourceBundle('de', DATABASE_NAMESPACE, germanWords);
```

Numbers, dates and durations follow the [format source](/ui/formatting/) of `UIProvider`.

## Try it without a server

`fakeDatabaseTransport` answers the protocol from memory, so a page runs without a backend or helper. See [Testing](/database/api/testing).
