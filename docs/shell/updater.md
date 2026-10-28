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

// The app's own handlers, behind its check of the sender.

handleFromApp('update:state', () => updater.state());
handleFromApp('update:configure', (_event, autoDownload: unknown) => updater.configure(autoDownload));
handleFromApp('update:check', () => updater.check());
handleFromApp('update:download', () => updater.download());
onFromApp('update:install', () => updater.install());
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

The page owns the preference. Nothing downloads and no timer runs until the page calls `configure`. From then on the updater checks once an hour. Only `true` turns downloading on. Pass `setInterval` to drive the timer from a test. A check is skipped while a check or download runs and once a build is ready.

`beforeCheck` runs right before each check, for example to refresh release notes.

## Installing

`install()` quits into the downloaded build and returns whether it did. Without a `ready` build it does nothing. electron-updater closes the windows before the app's `before-quit` runs, so `onQuit(true)` comes right before the install and `onQuit(false)` when the install fails. With a [set of windows](/shell/windows), the windows the install closes stay in the session, and they reopen if the install fails:

```ts
const updater = createUpdater({
    // ...
    onQuit: windows.quitForUpdate
});
```

## Errors

electron-updater puts the whole HTTP exchange, cookies included, in the message of a failed check. The state carries only `errorCode` and `error`, the first line of the message cut at 200 characters (or `null`). The shell sends no sentence of its own, so the page words the code in the person's language. `errorCode` is an `UpdateErrorCode`. `no-feed` is a 404 on the feed: no release is published yet, or the repository is private. Anything else is `failed`. Failures also go to `log`, `console.error` by default.

`UpdaterOptions` and `Updater` are exported types. `UpdateState` and `UpdateErrorCode` come from `@adecore/shell/bridge`.
