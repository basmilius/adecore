# Reference

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release. The component pages explain each name; the tables link to them.

| Entry point | Import it in |
| --- | --- |
| `@adecore/ui` | The page. |
| `@adecore/ui/settings` | The page, for a settings window. |
| `@adecore/ui/format` | The page, and any code that writes a number or date a person reads. |
| `@adecore/ui/testing` | Tests only. |
| `@adecore/ui/testing/dedupe` | The `preload` of `bun test`, in an app that links a checkout. It exports nothing; see [Testing](/ui/utilities/testing#a-linked-checkout-under-bun-test). |
| `@adecore/ui/theme.css` | The app's CSS, after Tailwind. See [Theme](/ui/guide/theme). |

## Exports

### `@adecore/ui`

The components, hooks and helpers.

<ExportTable entry="@adecore/ui" />

### `@adecore/ui/settings`

The [settings dialog](/ui/settings/settings-dialog) and the parts a pane is built from.

<ExportTable entry="@adecore/ui/settings" />

### `@adecore/ui/format`

The [formatters](/ui/formatting/) for numbers, dates and durations, and the format source they read.

<ExportTable entry="@adecore/ui/format" />

### `@adecore/ui/testing`

[Fakes](/ui/utilities/testing) for an app's own tests.

<ExportTable entry="@adecore/ui/testing" />
