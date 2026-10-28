# ShortcutHints

Hold Cmd (Ctrl on Windows and Linux) on its own for half a second, and every visible button with a shortcut prints it underneath. Let go and the hints disappear.

```tsx
import { ShortcutHints } from '@adecore/ui';

// once, anywhere in the app
<ShortcutHints />;
```

<Demo src="display/shortcut-hints" />

A button gets a hint when its [`Tooltip`](/ui/overlays/tooltip) or [`IconButton`](/ui/actions/icon-button) has a `kbd` that is a `Shortcut`, not a string. Only visible buttons count, not those under a dialog.

Any other key, a click, a scroll or losing window focus takes the hints down, so a shortcut pressed in passing never flashes them. Focus inside a `<webview>` shows none.

Mount it once. It takes no props and binds no shortcut.
