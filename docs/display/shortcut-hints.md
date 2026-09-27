# ShortcutHints

Hold Cmd (Ctrl on Windows and Linux) on its own for half a second, and every visible button with a shortcut prints it underneath. Let go and the hints disappear.

```tsx
import { ShortcutHints } from '@basmilius/react-ui';

// once, anywhere in the app
<ShortcutHints />;
```

<Demo src="display/shortcut-hints" />

Try it on the buttons above. A button shows up in the hints when its [`Tooltip`](/overlays/tooltip) or [`IconButton`](/actions/icon-button) has a `kbd` that is a real `Shortcut`; a phrase about a key is skipped. Only buttons a person can see count: on screen, not faded out, and not under a dialog.

Any other key, a click, a scroll or the window losing focus takes the hints down, so a shortcut pressed in passing never flashes them. The hints are measured before paint and every frame while they show, so they follow a button that moves.

Mount it once. It listens on the window in the capture phase, so a terminal or an editor that keeps keys to itself still takes the hints down, and it binds no shortcut of its own. It takes no props.
