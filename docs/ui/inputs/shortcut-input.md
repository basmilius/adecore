# ShortcutInput

A shortcut shown as keys, which turns into a recorder when pressed. For a settings page that lets a person choose their own keys.

```tsx
import { ShortcutInput } from '@adecore/ui';
```

<Demo src="inputs/shortcut-input" />

Click it, or focus it and press Enter, and it waits for a key. The first combination that `validate` accepts goes to `onChange` and recording ends. The input holds no shortcut of its own: hand the new value back as `value`.

While it records, it takes every key before the page does, so a shortcut the person presses does not run. A modifier on its own is waited through. Escape ends recording without a change, as does moving focus away or pressing the input again. A bare Backspace does nothing; with a modifier it is a key like another. A key that [`shortcut()`](/ui/utilities/shortcuts) cannot write, such as a numpad digit, is refused with the `unsupported` words.

`validate` returns the reason to refuse a shortcut, which shows in place of the prompt while recording goes on. Use it for the rules of the app: [a shortcut needs a modifier](/ui/guide/principles#every-shortcut-needs-a-modifier), and a key another row already holds is taken. The input leaves both to the app, since it cannot know what else is bound.

`onRecordingChange` tells the app when the input starts and stops waiting for a key, also when it unmounts while recording. An app that has a key handler registered before the input records can hold it back for that time.

The input reads the key with [`shortcutFromEvent`](/ui/utilities/shortcuts#recording), so the value it hands back matches on every platform and prints the way the platform writes it.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `Shortcut` | | Required. Printed while it is not recording. |
| `onChange` | `(next: Shortcut) => void` | | Required. Called with an accepted shortcut. |
| `label` | `string` | | Required. The accessible name; the current shortcut is read out after it. |
| `validate` | `(next: Shortcut) => string \| null` | | A reason to refuse the shortcut, or `null`. |
| `onRecordingChange` | `(recording: boolean) => void` | | |
| `labels` | `ShortcutInputLabels` | | `prompt` and `unsupported`, in the app's words. |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | |

`ShortcutInputProps` and `ShortcutInputLabels` are exported types.
