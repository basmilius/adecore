# UIProvider

What the library needs from an app, once, around the whole tree: its words in your i18next, the source of the formatters, the shared tooltip delay and the current input device. Mount it above the first component of the library.

```tsx
import { UIProvider } from '@adecore/ui';

<UIProvider i18n={i18next} formatSource={formatSource}>
    <App />
</UIProvider>;
```

It adds the words and sets the source during render, so the first child already reads both, and again when either prop changes.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `i18n` | `i18n` | | Required. Your i18next instance. |
| `formatSource` | `FormatSource` | | Where the formatters read the language and the region. Without one they keep the source they have, English by default. |
| `children` | `ReactNode` | | Required. |

`UIProviderProps` is an exported type.

## The pieces on their own

`UIProvider` adds the `ui` namespace in every shipped language to the i18next instance. A language that already has a `ui` bundle keeps it. `UI_NAMESPACE` is `'ui'`, and `UI_RESOURCES` holds the words by language code (`en` and `nl`), the source to translate a third language from.

`setFormatSource(source)` from `@adecore/ui/format` hands the formatters their source. See [Format source](/ui/formatting/).

`UIProvider` also holds the shared tooltip delay, see [Tooltip](/ui/overlays/tooltip#delay), and writes `data-modality="keyboard"` or `"pointer"` on `<html>` from the last real input event, see [input modality](/ui/guide/principles#input-modality).

## Words

A component reads its words through `useTranslation('ui')` on the instance you pass, never the global `i18next`, so a second React root with another instance speaks its own language.
