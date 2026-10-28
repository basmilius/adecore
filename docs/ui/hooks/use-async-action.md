# useAsyncAction

One step a surface waits on: busy while it runs, and the reason on screen when it fails.

```tsx
import { useAsyncAction } from '@adecore/ui';
```

<Demo src="hooks/use-async-action" />

`run(work)` clears the last failure, sets `busy`, awaits the work, and returns whether it succeeded:

```tsx
const step = useAsyncAction();

async function save(): Promise<void> {
    if (await step.run(() => api.save(draft))) {
        onClose();
    }
}
```

A rejection becomes `failure`, through [`messageOf`](/ui/utilities/error-messages). The `fallback` you pass the hook is the message when the rejection is not an `Error`.

## What it returns

| Member | Type | |
| --- | --- | --- |
| `busy` | `boolean` | `true` while `run` awaits. |
| `failure` | `string \| null` | The reason the last run failed. |
| `run(work)` | `(work: () => Promise<unknown>) => Promise<boolean>` | |
| `fail(message)` | `(message: string) => void` | Sets `failure` from the surface's own check. |
| `clear()` | `() => void` | |

[`PromptDialog`](/ui/overlays/prompt-dialog) runs its confirm through this hook. `AsyncAction` is an exported type.
