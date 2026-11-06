# UIProvider

What the library needs from an app, once, around the whole tree: its words in your i18next, the shared tooltip delay and the current input device. Mount it above the first component of the library.

```tsx
import { UIProvider } from '@adecore/ui';

<UIProvider i18n={i18next}>
    <App />
</UIProvider>;
```

It adds the words during render, so the first child already reads them, and again when the instance changes.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `i18n` | `i18n` | | Required. Your i18next instance. |
| `children` | `ReactNode` | | Required. |

`UIProviderProps` is an exported type.

## The pieces on their own

`UIProvider` adds the `ui` namespace in every shipped language to the i18next instance. A language that already has a `ui` bundle keeps it. `UI_NAMESPACE` is `'ui'`, and `UI_RESOURCES` holds the words by language code (`en` and `nl`), the source to translate a third language from.

The provider takes nothing else, because the formatters and the shortcuts also run outside React. Hand them what only the app knows before the first render:

- `setFormatSource(source)` from `@adecore/ui/format` hands the formatters their source. See [Format source](/ui/formatting/).
- `setApplePlatform(source)` hands `isApplePlatform()` the app's own answer, such as a desktop shell that knows its platform better than the page does. See [Shortcuts](/ui/utilities/shortcuts).

`UIProvider` also holds the shared tooltip delay, see [Tooltip](/ui/overlays/tooltip#delay), and writes `data-modality="keyboard"` or `"pointer"` on `<html>` from the last real input event, see [input modality](/ui/guide/principles#input-modality).

## Words

A component reads its words from the instance you pass, never the global `i18next`, so a second React root with another instance speaks its own language.
