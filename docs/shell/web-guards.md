# Web guards

The app's page carries the whole bridge, so where it may go and who may speak for it are security decisions. These are pure functions; the app wires them to Electron's events.

An app that serves its page from a scheme of its own (`app://main`) passes that scheme as `schemes`: Node's URL gives every scheme it does not know the origin `null`, where Chromium gives a registered standard scheme a real one. [`createAppScheme`](/shell/app-scheme) binds the scheme and the origin to all of them once.

## originOf

The origin of a URL, or `null` for one that does not parse or has no origin of its own (`about:`, `data:`).

```ts
originOf('http://127.0.0.1:4210/view'); // 'http://127.0.0.1:4210'
originOf('app://main/index.html', ['app']); // 'app://main'
```

`isAppUrl(url, appOrigin, schemes)` compares it with the app's origin.

## appWindowNavigation

Where the app window's own page may go. A dropped link or file navigates the top frame, and the page it lands on would inherit the bridge. So only the app stays (`allow`), a web link leaves for the system browser (`external`) and everything else stops (`refuse`). The three are the `NavigationVerdict` type.

```ts
contents.on('will-navigate', (event) => {
    const verdict = appWindowNavigation(event.url, appOrigin);
    if (verdict === 'allow') {
        return;
    }
    event.preventDefault();
    if (verdict === 'external') {
        void shell.openExternal(event.url);
    }
});
```

A frame inside the page is the app's own decision, since what it may show differs per app.

## isAppSender

Whether an IPC message came from the app itself: the top frame of an app window, still on the app's origin. The web contents alone says nothing, since it stays the same object whatever it navigates to. Check it in every handler before anything else. `SenderFrame` is the part of `event.senderFrame` it reads: `url` and `parent`.

```ts
const fromApp = (event: Electron.IpcMainInvokeEvent): boolean =>
    isAppSender(isAppWindow(event.sender), event.senderFrame, appOrigin);
```

## isExternalLink

What the system browser or mail app may be handed: a web or `mailto:` link. A `file:` link could open an application, so it never is. `isWebLink` is the web part alone.
