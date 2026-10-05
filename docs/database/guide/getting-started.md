# Getting started

The package has a page side and a backend side, and a native helper between the backend and the servers. This page installs it, builds the helper and wires the three together.

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

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies, so your app brings them. Base UI, Lucide and `clsx` come along. Only the page needs the peers: `@adecore/database/host` and `@adecore/database/protocol` import none of them, so a backend that never draws a view does not need React.

Set up [`@adecore/ui`](/ui/guide/getting-started) first. The views are made of its components and read its theme.

## Build the helper

The helper is a Rust program, `adecore-database`, in `packages/database/helper`. Today you build it with cargo, from a checkout of the repository:

```sh
cargo build --release --locked --manifest-path packages/database/helper/Cargo.toml
```

The binary lands in `packages/database/helper/target/release/adecore-database` (`.exe` on Windows). The release profile strips it and links it with LTO. SQLite is compiled in, and MySQL connections use rustls, so the binary needs no system library.

Ship it beside the app's own executable. In Electron that is an `extraResources` entry, and the binary is signed and notarized with the rest of the app. Build one per platform and architecture the app targets. Platform packages on npm that carry a prebuilt binary will follow; until then the app owns this step.

Find the binary from the backend:

```ts
import { join } from 'node:path';

const binary = process.platform === 'win32' ? 'adecore-database.exe' : 'adecore-database';
const helperPath = app.isPackaged ? join(process.resourcesPath, binary) : join(app.getAppPath(), 'bin', binary);
```

## Wire the host

The host sits in the app's backend, between a channel and the helper. Create one per app. It starts the helper on the first request and starts it again on the first request after the helper has exited.

Every request that comes over the channel goes to `host.handle(request, owner)`. The app checks the sender first, and `owner` names who is asking: a window, a socket. A session belongs to the owner that opened it, and no other owner can use it. When the owner goes away, call `host.release(owner)` so its sessions close. When the app quits, call `host.dispose()`.

The backend can live in three places.

### Electron main process

Register one `ipcMain.handle` channel. The check of the sender is yours: compare the frame's origin with the page you loaded.

```ts
import { app, ipcMain } from 'electron';
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath, { onLog: (line) => console.error(`[database] ${line}`) })
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

A window that reloads keeps its owner, so the sessions of the old page stay open until the window closes. Call `host.release(owner)` on a main-frame navigation if reloads matter to you.

### Electron utility process

A [utility process](https://www.electronjs.org/docs/latest/api/utility-process) moves the helper's pipes and the JSON work off the main process. The host runs in the utility process, and the main process forwards requests to it. Give each request a ticket so the answer finds its way back.

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
import { ipcMain, utilityProcess } from 'electron';

const worker = utilityProcess.fork(join(__dirname, 'database-worker.js'), [], {
    env: { ...process.env, ADECORE_DATABASE_HELPER: helperPath }
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

Release an owner the same way, with `worker.postMessage({ release: owner })` when its window is destroyed.

### Bun or Node server

When the page talks to a server over a WebSocket, an owner is a socket. The server authenticates the upgrade; the host does not know who a person is.

```ts
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';

const host = createDatabaseHost({ start: () => spawnHelper(helperPath) });

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

`host.handle` never rejects. A request that fails, for whatever reason, comes back as a response with `ok: false` and a [code](/database/guide/protocol#error-codes).

## Expose the channel to the page

In Electron the page reaches the channel through the preload, which exposes one function and nothing else:

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { DatabaseRequest, DatabaseResponse } from '@adecore/database/protocol';

contextBridge.exposeInMainWorld('database', {
    request: (request: DatabaseRequest): Promise<DatabaseResponse> => ipcRenderer.invoke('database:request', request)
});
```

`@adecore/database/protocol` holds only types and pure helpers, so a preload can import it.

Over a WebSocket, the transport matches each response to its request by `id`:

```ts
import type { DatabaseTransport } from '@adecore/database';

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

Create the client once and mount `DatabaseProvider` inside `UIProvider`. The provider hands the client to every view below it and adds the package's words to the i18next instance of `UIProvider`.

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

`DatabaseProvider` takes the `client` and `children` (`DatabaseProviderProps`). A view outside a `DatabaseProvider` throws. Components of your own that need the client read it with `useDatabaseClient()`. Call `client.dispose()` when the page goes away to close its sessions.

The views take a `Connection`, which is `{ id, name, config }`. The app keeps the list of them, with the password in its own storage, and [`ConnectionManager`](/database/views/connection-manager) edits it.

## Tailwind

The views are styled with Tailwind classes. Tell Tailwind to scan the package, next to the line for `@adecore/ui`. The path is relative to the CSS file it sits in:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";

@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/database/dist";
```

Without the second line the views render unstyled.

## Words and languages

The package's words live in the `database` namespace (`DATABASE_NAMESPACE`), in English and Dutch. `DatabaseProvider` adds both to the i18next instance with `addDatabaseResources`. An app that wires i18next itself calls `addDatabaseResources(i18next)` once, before the first view mounts.

A language you filled yourself keeps its words: `addDatabaseResources` skips a language that already has a `database` bundle. To translate the views into a third language, add a bundle for it before the provider mounts. `DATABASE_RESOURCES`, keyed by language code, holds the English source to translate from.

```ts
import { DATABASE_NAMESPACE } from '@adecore/database';

// `germanWords` has the same keys as DATABASE_RESOURCES.en.
i18next.addResourceBundle('de', DATABASE_NAMESPACE, germanWords);
```

Numbers, dates and durations in the views come from the formatters of [`@adecore/ui`](/ui/formatting/), so they follow the format source you gave `UIProvider`.

## Try it without a server

`fakeDatabaseTransport` answers the whole protocol from memory, so a page runs without a backend or a helper. See [Testing](/database/api/testing).
