# Clipboard and selection

The clipboard and the text selection, as an app with its own context menus uses them.

```tsx
import { copyText, readClipboardText, selectAllWithin, selectionWithin } from '@basmilius/desktop-ui';
```

<Demo src="utilities/clipboard" />

`copyText(text)` writes text to the clipboard. `readClipboardText()` answers what is on it, or an empty string when the browser will not say. A browser hands over the clipboard only to a focused document that is allowed to use it, and nobody can do anything about a refusal, so both stay quiet instead of throwing.

`selectionWithin(element)` answers the selected text, but only when the selection lies inside `element`. A context menu belongs to the surface the click landed on, and a selection somewhere else is not one that menu can copy. `selectAllWithin(element)` selects the text of `element` and nothing else, which is what Cmd+A should do inside a block of text. [`TextMenu`](/overlays/text-menu) uses both.
