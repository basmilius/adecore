import type { FileTree } from '@pierre/trees';
import { useEffect, useState } from 'react';

const SCROLLER = '[data-file-tree-virtualized-scroll="true"]';

/* The engine's own scroller, which lives in its shadow tree; null until the engine drew it. */
export function useFileTreeScroller(model: FileTree, frame: HTMLElement | null): HTMLElement | null {
    const [scroller, setScroller] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (frame === null) {
            return;
        }

        let shadow: ShadowRoot | null = null;

        const find = (): void => {
            const current = model.getFileTreeContainer()?.shadowRoot ?? null;

            // An observer on the frame sees the host arrive, never what the engine draws inside it.
            if (current !== null && current !== shadow) {
                shadow = current;
                changes.observe(shadow, { childList: true, subtree: true });
            }

            setScroller(current?.querySelector<HTMLElement>(SCROLLER) ?? null);
        };

        const changes = new MutationObserver(find);
        changes.observe(frame, { childList: true, subtree: true });
        const unsubscribe = model.subscribe(find);
        find();

        return () => {
            unsubscribe();
            changes.disconnect();
            setScroller(null);
        };
    }, [frame, model]);

    return scroller;
}
