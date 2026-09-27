# UIProvider

Everything the library needs from an app, once, around the whole tree: its words in your i18next, the source of the formatters, the shared tooltip delay and the note of which input device is in use. Mount it above the first component of the library.

```tsx
import { UIProvider } from '@basmilius/react-ui';

<UIProvider i18n={i18next} formatSource={formatSource}>
    <App />
</UIProvider>;
```

It adds the words and sets the source during render, so the first child already reads both. Handing it another i18n instance or source later does the same again.

| Prop | Type | |
| --- | --- | --- |
| `i18n` | `i18n` | Required. Your i18next instance. |
| `formatSource` | `FormatSource` | Where the formatters read the language and the region. Without one they write English. |
| `children` | `ReactNode` | Required. |

`UIProviderProps` is an exported type.

## The pieces on their own

An app that wires things up itself can call each piece directly.

`addUiResources(i18n)` adds the `ui` namespace in every language the library ships to an i18next instance. A language that already has a `ui` bundle keeps it. `UI_NAMESPACE` is the name of the namespace, `'ui'`, and `UI_RESOURCES` holds the words by language code (`en` and `nl`), which is the source to translate from for a third language.

`setFormatSource(source)` from `@basmilius/react-ui/format` hands the formatters their source. See [Format source](/formatting/).

`TooltipProvider` holds the shared tooltip delay. See [Tooltip](/overlays/tooltip#tooltipprovider).

`startInputModality()` starts writing `data-modality="keyboard"` or `"pointer"` on `<html>` from the last real input event. It runs once per page; a second call does nothing. See [input modality](/guide/principles#input-modality).

## Words

A component reads its words through `useTranslation('ui')` on the instance you pass, never through the global `i18next`. So the library speaks whatever language your instance is in, and a second React root with another instance speaks its own.
