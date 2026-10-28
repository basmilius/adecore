# Error messages

`messageOf(error, fallback?)` returns the sentence of an error, for a person to read.

```ts
import { messageOf } from '@adecore/ui';

try {
    await push();
} catch (error) {
    toasts.getState().show({ kind: 'error', title: 'Could not push', description: messageOf(error, 'The push failed.') });
}
```

An `Error` gives its message. For any other thrown value it returns `fallback`, or else the value as a string. It strips the prefix Electron adds to an error that crossed its bridge (`Error invoking remote method '...': Error:`).

[`useAsyncAction`](/ui/hooks/use-async-action) and [`PromptDialog`](/ui/overlays/prompt-dialog) show their failures through it.
