# Toasts

A stack of toasts in the bottom right corner, above dialogs: progress of a running action, its outcome, or a deletion that can still be undone. Create the store once and call it from anywhere.

```tsx
import { Toasts, createToastStore } from '@adecore/ui';

export const toasts = createToastStore();

// once, near the root
<Toasts store={toasts} />;
```

<Demo src="overlays/toasts" />

## Kinds and lifetimes

| Kind | Icon | Goes away |
| --- | --- | --- |
| `progress` | A spinner | When you update or dismiss it. |
| `success` | A check | After 4 seconds, unless `persist` is set. |
| `error` | An alert | When the person dismisses it. A failure waits to be read. |
| `deleted` | A trash can | After 8 seconds (`UNDO_MS`). |

A timed toast with an action, such as undo, shows a countdown ring instead of its close button. A timed toast without an action shows its close button only on hover or focus.

### A lifetime of its own

`lifetime` removes a toast after that many milliseconds, whatever its kind, and overrides `persist`. Zero or less is ignored; `Infinity` keeps the toast up. An `update` keeps it; patch `lifetime: undefined` to restore the kind's time.

<Demo src="overlays/toasts-lifetime" />

```ts
toasts.getState().show({ kind: 'error', title: 'New issue: WEB-142', lifetime: 10_000, action: { label: 'Open', run: open } });
```

## One id from start to end

Keep one toast from progress to outcome. `show` returns the id, and `update` moves that toast on:

```ts
const id = toasts.getState().show({ kind: 'progress', title: 'Pushing to origin' });
try {
    await push();
    toasts.getState().update(id, { kind: 'success', title: 'Pushed to origin' });
} catch (error) {
    toasts.getState().update(id, { kind: 'error', title: 'Could not push', description: messageOf(error) });
}
```

`show` with an existing id replaces that toast. `onClose` runs once a toast is gone, timed out or dismissed.

## The store

`createToastStore<T>()` returns a zustand store hook (`ToastStoreHook<T>`). Its state (`ToastStore<T>`) is:

| Member | |
| --- | --- |
| `toasts` | `T[]`, the toasts that are up, oldest first. |
| `show(toast)` | Puts one up, or replaces the one with the same `id`, and returns its id. Takes a `ToastInput<T>`. |
| `update(id, patch)` | Changes a toast that is up and restarts its timer. Takes a `ToastPatch<T>`. |
| `dismiss(id)` | Takes a toast down. |

A `Toast` is `{ id, title, kind, description?, action?, actions?, persist?, lifetime?, onClose?, deadline? }`. The store sets `deadline` (a `ToastDeadline` of `start` and `end` in epoch milliseconds). A `ToastAction` is `{ label, run, shortcut? }`; the shortcut is only printed. One action sits beside the title; with `actions`, two or more get their own line under the description. An action does not dismiss the toast; do that in `run` if needed. `ToastKind` is the union of the four kinds.

To carry more on a toast, extend `Toast`, pass the type to the store, and draw the extra fields with `footer`:

```tsx
interface AppToast extends Toast {
    output?: string;
}

const toasts = createToastStore<AppToast>();

<Toasts store={toasts} footer={(toast) => toast.output && <CopyOutputButton text={toast.output} />} />;
```

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `store` | `ToastStoreHook<T>` | | Required. |
| `footer` | `(toast: T) => ReactNode` | | Drawn under the description. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

The stack is a polite live region and renders nothing when empty. `ToastsProps`, `Toast`, `ToastAction`, `ToastDeadline`, `ToastInput`, `ToastKind`, `ToastPatch`, `ToastStore` and `ToastStoreHook` are exported types.
