# App scheme

A page served from a scheme of its own, such as `app://app`, gets a real origin without a server. `createAppScheme` serves each host of the scheme from its folder and binds the scheme and origin to the [web guards](/shell/web-guards).

The package registers nothing itself. Hand `privileged` to Electron before it is ready, and `handle` to the sessions you pick:

```ts
import { app, protocol, session } from 'electron';
import { createAppScheme } from '@adecore/shell';

const scheme = createAppScheme({
    scheme: 'app',
    root: join(process.resourcesPath, 'client'),
    headers: { 'content-security-policy': CSP },
    pageUrl: process.env.DEV_SERVER_URL
});

protocol.registerSchemesAsPrivileged([scheme.privileged]);

app.whenReady().then(() => {
    session.defaultSession.protocol.handle(scheme.scheme, scheme.handle);
    window.loadURL(scheme.url);
});
```

## Options

`AppSchemeOptions`:

| Option       | Default                | Meaning                                                                                       |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| `scheme`     | required               | The scheme without its colon                                                                  |
| `host`       | `app`                  | The host of the page                                                                          |
| `root`       | required               | The folder of the built page                                                                  |
| `routes`     | `true`                 | The page routes itself: an address without an extension gets its `index.html`                |
| `headers`    | none                   | Headers on every response of the page, such as its policy, or a function of the file         |
| `hosts`      | none                   | Other hosts on the same scheme, by name: a `SchemeFolder` or a `SchemeResolver`               |
| `pageUrl`    | the page's host        | The URL the window loads instead, such as a dev server; the guards take its origin           |
| `privileges` | standard and secure       | What Chromium allows the scheme                                                              |
| `read`       | reads the file whole   | Answers with a file it found; `(file) => net.fetch(pathToFileURL(file).href)` streams it      |

The default privileges give a real origin, a secure context, fetch and CORS, streaming, the code cache and service workers.

## What it serves

Each request is answered from the folder of its host. `/` serves `index.html`, and so does an address without an extension when the folder routes itself. A missing file is a 404, so a chunk replaced by a newer build fails as a load error. A path that climbs out of the folder (`..`, an escaped slash, a symlink) is a 404 too. The content type follows the extension.

A `SchemeFolder` is `{ root, routes?, headers? }`. A host whose files are not one folder, such as files found by an id, is a `SchemeResolver`: `(request, url) => Response`. It finds the file and answers through `serveFile(root, file, request, headers?)`, which serves only files inside `root`. `segmentsOf(pathname)` returns the decoded segments of a path, or `null` when one climbs out.

```ts
const scheme = createAppScheme({
    scheme: 'app',
    root: clientRoot,
    hosts: {
        render: { root: renderRoot, headers: { 'access-control-allow-origin': '*' } },
        attachment: async (request, url) => {
            const [folder, id] = segmentsOf(url.pathname) ?? [];
            const file = folder && id ? await findAttachment(folder, id) : null;
            return file === null ? new Response('Not found', { status: 404 }) : scheme.serveFile(attachmentsRoot, file, request);
        }
    }
});
```

## The guards

The returned `AppScheme` has `origin` (the app's origin for the guards), `url` (what the window loads) and the guards bound to both: `originOf(url)`, `isAppUrl(url)`, `navigation(url)` for [`appWindowNavigation`](/shell/web-guards#appwindownavigation) and `isAppSender(isAppWindow, frame)`. With `pageUrl` set, the app's origin is the dev server's, and the scheme's own page host no longer counts as the app.

```ts
const fromApp = (event: Electron.IpcMainInvokeEvent): boolean => scheme.isAppSender(isAppWindow(event.sender), event.senderFrame);
```
