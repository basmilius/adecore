# Error messages

`messageOf(error, fallback?)` answers the sentence of an error, for a person to read.

```ts
import { messageOf } from '@basmilius/desktop-ui';

try {
    await push();
} catch (error) {
    toasts.getState().show({ kind: 'error', title: 'Could not push', description: messageOf(error, 'The push failed.') });
}
```

An `Error` answers its message. A thrown value that is not an `Error` has no sentence in it, so the `fallback` names the step instead; without one, the value is turned into a string. An error that crossed an Electron bridge carries Electron's own prefix (`Error invoking remote method '...': Error:`), which says nothing to a person, so `messageOf` strips it.

[`useAsyncAction`](/desktop-ui/hooks/use-async-action) and [`PromptDialog`](/desktop-ui/overlays/prompt-dialog) show their failures through it.
