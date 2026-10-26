import { Suspense, lazy, useState, useSyncExternalStore, type ComponentProps, type ComponentType } from 'react';
import { noteLanding } from './lazy-landings.ts';
import { prefetcher } from './prefetch.ts';

/* `React.lazy` suspends for a tick even on a module the prefetcher already has, which mounts a dialog already open; a component here draws at once. */
export class LoadedComponent<Component> {
    current: Component | null = null;
    private readonly listeners = new Set<() => void>();
    private readonly loader: () => Promise<Component>;

    constructor(loader: () => Promise<Component>) {
        this.loader = loader;
    }

    async load(): Promise<Component> {
        const component = await this.loader();
        if (this.current === null) {
            this.current = component;
            for (const listener of this.listeners) {
                listener();
            }
            noteLanding();
        }
        return component;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

const openErrorListeners = new Set<(error: unknown) => void>();

/* Only a load for a render, which a person waits on; a failed prefetch never reaches it, not even one of the same module at the same moment. */
export function onLazyOpenError(listener: (error: unknown) => void): () => void {
    openErrorListeners.add(listener);
    return () => {
        openErrorListeners.delete(listener);
    };
}

/* Only a render loads through here; the prefetcher calls `loaded.load()` itself, so its failures report nothing. */
async function open<Component>(loaded: LoadedComponent<Component>): Promise<{ default: Component }> {
    try {
        return { default: await loaded.load() };
    } catch (error) {
        for (const listener of openErrorListeners) {
            listener(error);
        }
        throw error;
    }
}

/* A lazy component, with `preload` to have its module before the first render, so that render never suspends. */
export type LazyComponent<Props> = ComponentType<Props> & { readonly preload: () => Promise<void> };

/* Registers with `prefetcher`, like `lazyDialog`, so `prefetcher.prefetchEverything()` loads it ahead of its first opening. */
export function lazyNamed<Module extends Record<Name, ComponentType<any>>, Name extends keyof Module>(
    load: () => Promise<Module>,
    name: Name
): LazyComponent<ComponentProps<Module[Name]>> {
    const loaded = new LoadedComponent(async () => (await load())[name]);
    prefetcher.register(() => loaded.load());
    const Lazy = lazy(() => open(loaded));
    // Once `loaded` has it, `Lazy` never committed anything, so switching over remounts nothing.
    const LazyNamed = (props: ComponentProps<Module[Name]>) => {
        // `loaded` fills in place; compiled, the element drawn before the module landed would stay.
        'use no memo';
        const Component: ComponentType<any> = loaded.current ?? Lazy;
        return <Component {...props} />;
    };
    return Object.assign(LazyNamed, {
        preload: async () => {
            await loaded.load();
        }
    });
}

/* Stays true after the first opening, so every close after it still has something mounted to animate. */
function useOpenedOnce(open: boolean): boolean {
    const [opened, setOpened] = useState(open);
    if (open && !opened) {
        setOpened(true);
    }
    return opened || open;
}

/* Once its module is here it stays mounted closed, so its first opening animates like every other. */
export function lazyDialog<Module extends Record<Name, ComponentType>, Name extends keyof Module, State>(
    load: () => Promise<Module>,
    name: Name,
    useStore: (select: (state: State) => boolean) => boolean,
    isOpen: (state: State) => boolean
): ComponentType {
    const loaded = new LoadedComponent(async (): Promise<ComponentType> => (await load())[name]);
    prefetcher.register(() => loaded.load());
    const Dialog = lazy(() => open(loaded));
    const subscribe = (listener: () => void) => loaded.subscribe(listener);
    const isLoaded = () => loaded.current !== null;
    const LazyDialog = () => {
        // As in `lazyNamed`: what `loaded` holds is read again on every render.
        'use no memo';
        const opened = useOpenedOnce(useStore(isOpen));
        useSyncExternalStore(subscribe, isLoaded);
        const Loaded: ComponentType | null = loaded.current;
        if (Loaded) {
            return <Loaded />;
        }
        if (!opened) {
            return null;
        }
        return (
            <Suspense fallback={null}>
                <Dialog />
            </Suspense>
        );
    };
    return LazyDialog;
}
