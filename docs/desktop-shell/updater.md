# Updater

`createUpdater` puts electron-updater behind a state the page watches instead of a dialog that interrupts. Every change goes to `publish` as an `UpdateState`, which the page draws as a button or a line in its About pane.

```ts
import { createUpdater } from '@basmilius/desktop-shell';

const updater = createUpdater({
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    load: () => require('electron-updater').autoUpdater,
    publish: (state) => window.webContents.send('update:state', state)
});

app.whenReady().then(() => updater.start());

handleFromApp('update:state', () => updater.state());
handleFromApp('update:configure', (_event, autoDownload: unknown) => updater.configure(autoDownload));
handleFromApp('update:check', () => updater.check());
handleFromApp('update:download', () => updater.download());
onFromApp('update:install', () => updater.install());
```

## States

| `status` | Means |
|---|---|
| `unsupported` | A checkout. electron-updater reads its feed from the bundle, so there is none. |
| `idle` | Started, nothing checked yet. |
| `checking` | A check runs. |
| `current` | The check found nothing newer. |
| `available` | `version` is newer and not downloaded. |
| `downloading` | `percent` of it is in. |
| `ready` | Downloaded; `install` restarts into it. |
| `error` | `error` says why, in one line. |

## Who decides to download

The page owns the preference. Nothing downloads and no timer runs until the page sends it with `configure`; from then on the updater checks once an hour. Only `true` turns downloading on. A check is skipped while one runs, while a download runs and once a build is ready.

`beforeCheck` runs right before a check asks the feed, such as to refresh release notes along with it.

## Installing

`install()` quits into the downloaded build and answers whether it did: without a build that is `ready` it does nothing. electron-updater closes the windows before the app's own `before-quit` runs, so `onQuit(true)` comes right before the install, and `onQuit(false)` when the install fails and the app stays. With a [set of windows](/desktop-shell/windows) that is where the session learns about the quit:

```ts
const updater = createUpdater({
    // ...
    onQuit: (quitting) => (quitting ? windows.quit() : windows.resume())
});
```

## Errors

electron-updater puts the whole HTTP exchange in the message of a failed check, cookies included. `describeUpdateError` keeps the first line only, and turns a 404 on the feed into a sentence that says there is no published release, or that the repository is private.
