# Lazy loading

Components loaded on first use, and a prefetcher that loads them ahead of that once the app is idle.

```tsx
import { LazyBoundary, lazyDialog, lazyNamed, onLazyOpenError, prefetcher } from '@adecore/ui';
```

<Demo src="utilities/lazy-loading" />

## lazyNamed

`lazyNamed(load, name)` is `React.lazy` for a module that exports its component by name, `default` included. Unlike `React.lazy`, it draws at once when the module is already loaded, without flashing the fallback.

```tsx
const HistoryPanel = lazyNamed(() => import('./HistoryPanel'), 'HistoryPanel');
```

It returns a `LazyComponent`, a component with `preload()`. Hand `preload` to the prefetcher to load one surface first, such as the screen a person is about to open.

```tsx
void prefetcher.prefetch(HistoryPanel.preload);
```

## LazyBoundary

`LazyBoundary` is `Suspense` for what `lazyNamed` loads, with the same `fallback` (`LazyBoundaryProps`). Unlike `Suspense`, it shows the content the moment its module lands, without React's minimum fallback time.

```tsx
<LazyBoundary fallback={<PanelSkeleton />}>
    <HistoryPanel />
</LazyBoundary>
```

## lazyDialog

`lazyDialog(load, name, useStore, isOpen)` is for a dialog whose open state lives in a store. Opening it loads the module. Once loaded, it stays mounted while closed, so its first opening animates too.

```tsx
const SettingsWindow = lazyDialog(() => import('./SettingsWindow'), 'SettingsWindow', useAppStore, (state) => state.settingsOpen);
```

## The prefetcher

Every module loaded through `lazyNamed` or `lazyDialog` registers with `prefetcher`. Call `prefetcher.prefetchEverything()` once the app has drawn its first screen; it loads every registered module, one per idle moment. Modules registered later join the queue. `prefetcher.prefetch(load)` loads one module ahead of the rest.

The prefetcher does nothing while the browser asks to save data. A failed prefetch is quiet; the first real use tries again. `prefetcher.busy` is true while a prefetch waits on its chunk, so a chunk failure the app hears of elsewhere may be the prefetch's. `onLazyOpenError` only hears the failures a person waits on.

`WhenIdle` is a function that calls back once the main thread is free, and `Loader` is a function that loads a module.

## A failed open

`onLazyOpenError(listener)` calls `listener` with the error when a module loaded for a render fails. A failed prefetch never reaches it. It returns a function that stops listening.

A failed surface stays down until the page reloads, so this is the place to reload once after a deploy removed the old chunks.

```tsx
const stop = onLazyOpenError((error) => console.warn('A lazy surface failed to load', error));
```

## LoadedComponent

`LoadedComponent` is the cache both helpers share: a loader, the component once it is loaded (`current`), `load()` and `subscribe(listener)`. You rarely need it directly.
