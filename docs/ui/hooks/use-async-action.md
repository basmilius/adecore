# useAsyncAction

One step a surface waits on. The button goes quiet while it runs, and the reason stays on screen when it fails.

```tsx
import { useAsyncAction } from '@adecore/ui';
```

<Demo src="hooks/use-async-action" />

The first press fails, the second goes through. `run(work)` clears the last failure, sets `busy`, awaits the work, and answers whether it went through, so the caller closes a dialog or steps on only on success:

```tsx
const step = useAsyncAction();

async function save(): Promise<void> {
    if (await step.run(() => api.save(draft))) {
        onClose();
    }
}
```

A rejection becomes `failure`, the error's message through [`messageOf`](/ui/utilities/error-messages). The `fallback` you pass the hook names the step when the rejection carries no sentence of its own, such as a thrown string.

## What it answers

| Member | Type | |
| --- | --- | --- |
| `busy` | `boolean` | True while `run` awaits. |
| `failure` | `string \| null` | The reason the last run failed. |
| `run(work)` | `(work: () => Promise<unknown>) => Promise<boolean>` | |
| `fail(message)` | `(message: string) => void` | A refusal the surface sees for itself, shown in the same line as one that came back. |
| `clear()` | `() => void` | |

[`PromptDialog`](/ui/overlays/prompt-dialog) runs its confirm through this hook. `AsyncAction` is an exported type.
