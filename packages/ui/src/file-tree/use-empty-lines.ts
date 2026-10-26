import { useEffect, useLayoutEffect, useRef } from 'react';
import type { FileTree } from '@pierre/trees';
import { emptyLineChanges, isEmptyLine, pastEmptyLine, skipEmptyLine, type FileTreeEmptyLabel } from './empty-lines.ts';
import { movesFocus, visibleRows } from './helpers.ts';

const POINTER_EVENTS = ['pointerdown', 'mousedown', 'click', 'dblclick', 'auxclick', 'contextmenu', 'dragstart'] as const;

function onEmptyLine(event: Event): boolean {
    return event.composedPath().some((node) => node instanceof HTMLElement && node.dataset.emptyLine === 'true');
}

/* A pointer on a line does nothing and a key passes it. Call what it returns with every key the tree hears, after anything that notes where focus was. */
export function useEmptyLines(model: FileTree, frame: HTMLElement | null, emptyLabel: FileTreeEmptyLabel | undefined): (event: KeyboardEvent) => void {
    const latest = useRef(emptyLabel);
    const reconcile = useRef<(() => void) | undefined>(undefined);
    // Focus that lands on a line goes on in the direction of the last key, which the engine handles after the tree hears it.
    const lastKey = useRef('');
    const enabled = emptyLabel !== undefined;

    useLayoutEffect(() => {
        latest.current = emptyLabel;
        reconcile.current?.();
    }, [emptyLabel]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const added = new Set<string>();
        let pending = false;
        let disposed = false;

        const run = (): void => {
            pending = false;
            const labelOf = latest.current;

            if (disposed || labelOf === undefined) {
                return;
            }

            const selectedLines = model.getSelectedPaths().filter(isEmptyLine);

            for (const path of selectedLines) {
                model.getItem(path)?.deselect();
            }

            // A selection that followed focus onto the line follows it on to where it went.
            const focused = skipEmptyLine(model, lastKey.current) ? model.getFocusedPath() : null;

            if (focused !== null && selectedLines.length > 0) {
                model.getItem(focused)?.select();
            }

            const { add, remove } = emptyLineChanges(visibleRows(model), labelOf, (path) => model.getItem(path) !== null, added);

            for (const path of remove) {
                added.delete(path);
            }

            for (const path of add) {
                added.add(path);
            }

            if (add.length > 0 || remove.length > 0) {
                model.batch([...remove.map((path) => ({ type: 'remove' as const, path })), ...add.map((path) => ({ type: 'add' as const, path }))]);
            }
        };

        const schedule = (): void => {
            if (!pending && !disposed) {
                pending = true;
                queueMicrotask(run);
            }
        };

        reconcile.current = schedule;
        const unsubscribe = model.subscribe(schedule);
        run();

        return () => {
            disposed = true;
            reconcile.current = undefined;
            unsubscribe();
            const left = [...added].filter((path) => model.getItem(path) !== null);

            if (left.length > 0) {
                model.batch(left.map((path) => ({ type: 'remove' as const, path })));
            }
        };
    }, [model, enabled]);

    useEffect(() => {
        if (frame === null) {
            return;
        }

        const block = (event: Event): void => {
            if (onEmptyLine(event)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };

        for (const type of POINTER_EVENTS) {
            frame.addEventListener(type, block, true);
        }

        return () => {
            for (const type of POINTER_EVENTS) {
                frame.removeEventListener(type, block, true);
            }
        };
    }, [frame]);

    return (event: KeyboardEvent): void => {
        lastKey.current = event.key;
        const past = latest.current !== undefined && movesFocus(event) ? pastEmptyLine(model, event.key) : null;

        if (past === null) {
            return;
        }

        // The engine never sees this key, so focus never lands on the line for a moment.
        event.preventDefault();
        event.stopPropagation();

        if (past !== model.getFocusedPath()) {
            model.scrollToPath(past, { focus: true, offset: 'nearest' });
        }
    };
}
