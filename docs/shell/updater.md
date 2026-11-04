# Updater

`createUpdater` puts electron-updater behind a state the page watches, with no dialog. Every change goes to `publish` as an `UpdateState`.

```ts
import { createUpdater } from '@adecore/shell';

const updater = createUpdater({
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    load: () => require('electron-updater').autoUpdater,
    publish: (state) => window.webContents.send('update:state', state)
});

app.whenReady().then(() => updater.start());

// `ipc` is the app's createAppIpc, which checks the sender first.
ipc.handle('update:state', () => updater.state());
ipc.on('update:configure', (_event, autoDownload: unknown) => updater.configure(autoDownload));
ipc.handle('update:check', () => updater.check());
ipc.handle('update:download', () => updater.download());
ipc.on('update:install', () => updater.install());
```

`start()` calls `load` only in a packaged app, so a checkout never imports electron-updater and its state stays `unsupported`. When `load` throws, as when electron-updater is missing from the bundle, the error goes to `log` and the app keeps running. With several windows, publish to all of them with `windows.send('update:state', state)`.

## In the page

The page reads the state once, follows each change and draws what fits the status. `desktop` is what the [preload](/shell/getting-started#the-preload) exposes:

```tsx
import { Button } from '@adecore/ui';
import type { UpdateState } from '@adecore/shell/bridge';
import { useEffect, useState } from 'react';

function UpdateNotice() {
    const [state, setState] = useState<UpdateState | null>(null);

    useEffect(() => {
        void desktop.update.state().then(setState);

        return desktop.update.onState(setState);
    }, []);

    if (state?.status === 'available') {
        return <Button onClick={() => desktop.update.download()}>Download {state.version}</Button>;
    }

    if (state?.status === 'ready') {
        return <Button onClick={() => desktop.update.install()}>Restart to update</Button>;
    }

    return null;
}
```

## States

| `status` | Means |
|---|---|
| `unsupported` | Not packaged, so there is no feed. |
| `idle` | Started, nothing checked yet. |
| `checking` | A check runs. |
| `current` | The check found nothing newer. |
| `available` | `version` is newer and not downloaded. |
| `downloading` | `percent` of it is in. |
| `ready` | Downloaded; `install` restarts into it. |
| `error` | `errorCode` says why, `error` holds the first line of the message. |

## Who decides to download

The page owns the preference. Nothing downloads and no timer runs until the page calls `configure`. From then on the updater checks once an hour. `configure` itself checks nothing, so the page calls `check()` when it wants an answer at once. Only `true` turns downloading on; anything else leaves the download to `download()`. Pass `setInterval` to drive the timer from a test. The updater skips a check while a check or download runs and once a build is ready.

`beforeCheck` runs right before each check, for example to refresh release notes.

## Installing

`install()` quits into the downloaded build and returns whether it did. Without a `ready` build it does nothing. electron-updater closes the windows before the app's `before-quit` runs, so `onQuit(true)` comes right before the install and `onQuit(false)` when the install fails. With a [set of windows](/shell/quitting#an-update-install), the windows the install closes stay in the session, and they reopen if the install fails:

```ts
const updater = createUpdater({
    // ...
    onQuit: windows.quitForUpdate
});
```

With `silentInstall`, an install on Windows shows none of the installer's windows and starts the app again after. Other platforms ignore it.

`setAllowPrerelease(allow)` chooses which releases the updater offers. Without it the updater follows the running version. Leaving prereleases also drops one that is offered, downloading or waiting to install, so neither `install()` nor a quit installs it. A finished release stays. A check that runs during the change runs again once it ends. Call `check()` after it for the answer of the new choice.

## Errors

electron-updater puts the whole HTTP exchange, cookies included, in the message of a failed check. The state carries only `errorCode` and `error`, the first line of the message cut at 200 characters (or `null`). The shell sends no sentence of its own, so the page words the code in the person's language. `errorCode` is an `UpdateErrorCode`. `no-feed` is a 404 on the feed: no release is published yet, or the repository is private. Anything else is `failed`. Failures also go to `log`, `console.error` by default.

`createUpdater` takes `UpdaterOptions` and returns an `Updater`. `UpdateState` and `UpdateErrorCode` come from `@adecore/shell/bridge`.
