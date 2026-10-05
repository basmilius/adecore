# useAsyncAction

One step a surface waits on: busy while it runs, and the reason on screen when it fails.

```tsx
import { useAsyncAction } from '@adecore/ui';
```

<Demo src="hooks/use-async-action" />

The first press fails, the second goes through. `run(work)` clears the last failure, sets `busy`, awaits the work, and returns whether it went through, so the caller closes a dialog or steps on only on success:

```tsx
const step = useAsyncAction();

async function save(): Promise<void> {
    if (await step.run(() => api.save(draft))) {
        onClose();
    }
}
```

A rejection becomes `failure`, the error's message through [`messageOf`](/ui/utilities/error-messages). The `fallback` you pass the hook names the step when the rejection is not an `Error`, such as a thrown string.

## What it returns

| Member | Type | |
| --- | --- | --- |
| `busy` | `boolean` | `true` while `run` awaits. |
| `failure` | `string \| null` | The reason the last run failed. |
| `run(work)` | `(work: () => Promise<unknown>) => Promise<boolean>` | |
| `fail(message)` | `(message: string) => void` | A refusal the surface sees for itself, shown in the same line as one that came back. |
| `clear()` | `() => void` | |

[`PromptDialog`](/ui/overlays/prompt-dialog) runs its confirm through this hook. `AsyncAction` is an exported type.
