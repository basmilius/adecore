# Web guards

The app's page carries the whole bridge, so where it may go and who may speak for it are security decisions. These are pure functions. The app wires them to Electron's events.

A page served from its own scheme (`app://main`) passes that scheme as `schemes`, because Node's URL gives an unknown scheme the origin `null`. [`createAppScheme`](/shell/app-scheme) binds scheme and origin to all of them.

## originOf

The origin of a URL, or `null` for one that does not parse or has no origin of its own (`about:`, `data:`).

```ts
originOf('http://127.0.0.1:4210/view'); // 'http://127.0.0.1:4210'
originOf('app://main/index.html', ['app']); // 'app://main'
```

`isAppUrl(url, appOrigin, schemes)` compares it with the app's origin.

## appWindowNavigation

Where the app window's page may go. A dropped link or file navigates the top frame, and the page it lands on would inherit the bridge. The app's own origin is `allow`, a web link is `external` (open it in the system browser) and anything else is `refuse`. The three make up `NavigationVerdict`.

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

Frames inside the page are the app's own decision.

## isAppSender

Whether an IPC message came from the top frame of an app window that is still on the app's origin. The web contents alone proves nothing, since it stays the same object whatever it navigates to. Check it first in every handler. `SenderFrame` is the part of `event.senderFrame` it reads: `url` and `parent`.

```ts
const fromApp = (event: Electron.IpcMainInvokeEvent): boolean =>
    isAppSender(isAppWindow(event.sender), event.senderFrame, appOrigin);
```

## isExternalLink

What the system browser or mail app may be handed: a web or `mailto:` link. A `file:` link could open an application, so it never is. `isWebLink` is the web part alone.

## createGestureGate

Whether a link the page wants to open externally follows a real press. Without it, an untrusted script could open the browser over and over. `saw` takes the type of every input event; only a press or a key counts. `consume` returns whether one came within the last second and uses it up, so one press lets one link out. The clock defaults to `Date.now`. `GestureGate` is the returned type.

```ts
const gesture = createGestureGate();
contents.on('input-event', (_event, input) => gesture.saw(input.type));
contents.setWindowOpenHandler(({ url }) => {
    if (isExternalLink(url) && gesture.consume()) {
        void shell.openExternal(url);
    }
    return { action: 'deny' };
});
```
