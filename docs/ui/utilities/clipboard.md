# Clipboard and selection

The clipboard and the text selection, as an app with its own context menus uses them.

```tsx
import { copyText, readClipboardText, selectAllWithin, selectionWithin } from '@adecore/ui';
```

<Demo src="utilities/clipboard" />

`copyText(text)` writes text to the clipboard and resolves to whether it worked. `readClipboardText()` resolves to the clipboard text, or an empty string when the browser refuses. Neither rejects. A button that copies and confirms it is a [`CopyButton`](/ui/actions/copy-button).

`selectionWithin(element)` returns the selected text only when the selection lies inside `element`, so a context menu copies only from its own surface. `selectAllWithin(element)` selects the text of `element` alone, as Cmd+A should inside a block of text. [`TextMenu`](/ui/overlays/text-menu) uses both.
