# Toasts

A stack of toasts in the bottom right corner, over everything: what an action is doing while it runs, how it went when it is over, and a deletion that can still be taken back. The toasts live in a store you create once and call from anywhere.

```tsx
import { Toasts, createToastStore } from '@basmilius/react-ui';

export const toasts = createToastStore();

// once, near the root
<Toasts store={toasts} />;
```

<Demo src="overlays/toasts" />

## Kinds and lifetimes

| Kind | Icon | Goes away |
| --- | --- | --- |
| `progress` | A spinner | When you update or dismiss it. |
| `success` | A check | After 4 seconds (`SUCCESS_MS`), unless `persist` is set. |
| `error` | An alert | When the person dismisses it. A failure waits to be read. |
| `deleted` | A trash can | After 8 seconds (`UNDO_MS`). |

A toast with an `action` that goes by itself, such as the undo of a deletion, shows a ring in place of its close button that counts down to the moment it goes. The ring starts as far along as the timer already is, so both end together. With reduced motion the ring stays full. A toast that goes by itself keeps its close button hidden until the pointer or the keyboard is on it.

## One id from start to end

A long action keeps one toast from progress to outcome, so a person never watches two cards for one thing. `show` answers the toast's id; `update` moves that toast on:

```ts
const id = toasts.getState().show({ kind: 'progress', title: 'Pushing to origin' });
try {
    await push();
    toasts.getState().update(id, { kind: 'success', title: 'Pushed to origin' });
} catch (error) {
    toasts.getState().update(id, { kind: 'error', title: 'Could not push', description: messageOf(error) });
}
```

`show` with the id of a toast that is already up replaces it. `onClose` runs once a toast is gone, whether it ran out or was dismissed.

## The store

`createToastStore<T>()` returns a zustand store hook (`ToastStoreHook<T>`). Its state (`ToastStore<T>`) is:

| Member | |
| --- | --- |
| `toasts` | `T[]`, the toasts that are up, oldest first. |
| `show(toast)` | Puts one up, or replaces the one with the same `id`. Answers its id. Takes a `ToastInput<T>`. |
| `update(id, patch)` | Changes a toast that is up and restarts its timer. Takes a `ToastPatch<T>`. |
| `dismiss(id)` | Takes a toast down. |

A `Toast` is `{ id, title, kind, description?, action?, actions?, persist?, onClose?, deadline? }`. The store sets `deadline` (a `ToastDeadline` of `start` and `end` in epoch milliseconds) from the timer that takes the toast away. `elapsedOf(deadline, now)` says how far into its lifetime a toast is. A `ToastAction` is `{ label, run, shortcut? }`; the shortcut is only printed, so bind the key yourself. One action sits beside the title. With `actions`, drawn after `action` in order, two or more get a line of their own under the description, so the title keeps its width. An action does not take the toast away; dismiss it in `run` when that is what should happen. `ToastKind` is the union of the four kinds.

An app that carries more on a toast extends `Toast` and hands its type to the store, then draws the extra fields with `footer`:

```tsx
interface AppToast extends Toast {
    output?: string;
}

const toasts = createToastStore<AppToast>();

<Toasts store={toasts} footer={(toast) => toast.output && <CopyOutputButton text={toast.output} />} />;
```

## Props

| Prop | Type | |
| --- | --- | --- |
| `store` | `ToastStoreHook<T>` | Required. |
| `footer` | `(toast: T) => ReactNode` | Drawn under the description. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

The stack is a polite live region, so a screen reader announces a new toast without interrupting. `ToastsProps`, `Toast`, `ToastAction`, `ToastDeadline`, `ToastInput`, `ToastKind`, `ToastPatch`, `ToastStore` and `ToastStoreHook` are exported types.
