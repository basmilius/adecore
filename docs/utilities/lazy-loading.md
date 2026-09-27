# Lazy loading

Components loaded on first use, and a prefetcher that loads them ahead of that once the app is idle.

```tsx
import { lazyDialog, lazyNamed, prefetcher } from '@basmilius/react-ui';
```

<Demo src="utilities/lazy-loading" />

## lazyNamed

`lazyNamed(load, name)` is `React.lazy` for a module that exports its component by name, `default` included. It answers a component with the same props, which suspends until the module is there. Once the module is loaded it draws straight away. `React.lazy` suspends for a tick even on a module the bundler already has, which flashes the fallback and would mount a dialog already open.

```tsx
const HistoryPanel = lazyNamed(() => import('./HistoryPanel'), 'HistoryPanel');
```

## lazyDialog

`lazyDialog(load, name, useStore, isOpen)` is for a dialog that keeps its own open state in a store. Before its module is here, opening it loads it. Once it is here, prefetched or opened, it stays mounted while closed, so even its first opening animates like every later one.

```tsx
const SettingsWindow = lazyDialog(() => import('./SettingsWindow'), 'SettingsWindow', useAppStore, (state) => state.settingsOpen);
```

## The prefetcher

Every module loaded through `lazyNamed` or `lazyDialog` registers with `prefetcher`. Call `prefetcher.prefetchEverything()` once the app has drawn its first screen, and it loads every registered module ahead of its first use, one per idle moment and never two at once. A module registered afterwards, such as a lazy surface inside another, joins the end of the queue. `prefetcher.prefetch(load)` loads one module ahead of the rest.

The prefetcher does nothing while the browser asks to save data. A failed prefetch is quiet; the first real use tries again. `prefetcher.busy` is true while a prefetch waits on its chunk, so an app that reloads on a failed chunk can tell a prefetch's failure from a person's.

`Prefetcher` is the class behind it, for a test or a second queue: `new Prefetcher(whenIdle, allowed?)`. `WhenIdle` is a function that calls back once the main thread is free, and `Loader` is a function that loads a module.

## LoadedComponent

`LoadedComponent` is the cache both helpers share: a loader, the component once it is loaded (`current`), `load()` and `subscribe(listener)`. You rarely need it directly.
