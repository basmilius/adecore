# Navigation and links

The app's page carries the whole bridge, so where it may go is a security decision. A dropped link or file navigates the top frame, and the page it lands on would inherit the bridge. The helpers below are pure functions, and the app wires them to Electron's events on each window.

A page served from its own scheme (`app://app`) passes that scheme as `schemes`, because Node's URL gives an unknown scheme the origin `null`. [`createAppScheme`](/shell/app-scheme#the-guards) binds the scheme and the origin to each of them, so `scheme.navigation(url)` needs neither.

## originOf

The origin of a URL, or `null` for one that does not parse or has no origin of its own (`about:`, `data:`).

```ts
originOf('http://127.0.0.1:4210/view'); // 'http://127.0.0.1:4210'
originOf('app://main/index.html', ['app']); // 'app://main'
originOf('about:blank'); // null
```

`isAppUrl(url, appOrigin, schemes)` tells whether a URL is on the app's origin.

## appWindowNavigation

Where the app window's page may go. The app's own origin is `allow`, a web link is `external` (open it in the system browser) and anything else is `refuse`. The three make up `NavigationVerdict`.

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

## isExternalLink

What the system browser or mail app may be handed: a web or `mailto:` link. A `file:` link could open an application, so it never counts. `isWebLink` is the web part alone, `http:` and `https:`.

## createGestureGate

Whether a link the page wants to open externally follows a real press. Without it, a script nobody vetted could open the browser over and over. `saw` takes the type of every input event; only a mouse press or release, a key, a tap or the end of a touch counts. `consume` returns whether one came within the last second and uses it up, so one press lets one link out. It returns a `GestureGate`, and a test can pass a clock in place of `Date.now`.

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
