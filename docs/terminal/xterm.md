# Going past the props

The props cover what every terminal needs. What one app needs, such as its own key bindings, reaches xterm directly.

## The xterm instance

`terminal` on the handle is the xterm instance, or `null` before mount. A parent's effect already sees it, and it stays until unmount. Use it for:

- a key handler, with `attachCustomKeyEventHandler`,
- an OSC handler, such as one for the clipboard (OSC 52),
- a registry of open terminals,
- a link provider, measured with [`linkLineBounds`](/terminal/links#measuring-in-a-link-provider-of-your-own).

```tsx
useEffect(() => {
    const terminal = view.current?.terminal;

    if (terminal === null || terminal === undefined) {
        return;
    }

    terminal.attachCustomKeyEventHandler((event) => {
        // Leaves Cmd+K to the app, which clears the view instead of sending it to the program.
        if (event.type === 'keydown' && event.metaKey && event.key === 'k') {
            view.current?.reset();

            return false;
        }

        return true;
    });
}, []);
```

Leave the options the view manages alone: the theme, the font, the size and the input mode. The view sets them again on its next change.

## Under a scaled ancestor

Under a CSS transform, such as a zooming canvas, clicks land on the wrong cell, because xterm measures the screen without the scale. `scaledByAncestor` corrects pointer positions for the scale. It is read once, at mount.
