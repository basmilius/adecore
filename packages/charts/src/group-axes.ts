import { useId, useSyncExternalStore } from 'react';
import { useBeforePaint } from './register.ts';

export interface AxisWidths {
    subscribe(listener: () => void): () => void;
    set(id: string, left: number, right: number): void;
    remove(id: string): void;
    left(): number;
    right(): number;
}

/* The widest y axis on each side among the charts of a group, so their plots start and end at the same pixel. */
export function createAxisWidths(): AxisWidths {
    const listeners = new Set<() => void>();
    const widths = new Map<string, [number, number]>();
    let left = 0;
    let right = 0;

    const settle = (): void => {
        const nextLeft = Math.max(0, ...[...widths.values()].map(([width]) => width));
        const nextRight = Math.max(0, ...[...widths.values()].map(([, width]) => width));

        if (nextLeft !== left || nextRight !== right) {
            left = nextLeft;
            right = nextRight;

            for (const listener of listeners) {
                listener();
            }
        }
    };

    return {
        subscribe(listener) {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        set(id, nextLeft, nextRight) {
            widths.set(id, [nextLeft, nextRight]);
            settle();
        },
        remove(id) {
            widths.delete(id);
            settle();
        },
        left: () => left,
        right: () => right
    };
}

const NONE = (): (() => void) => () => {};
const ZERO = (): number => 0;

/* The y axes of a chart, widened to the widest of its group; outside a group they stay as they are. */
export function useAlignedAxes(widths: AxisWidths | null, left: number, right: number): [number, number] {
    const id = useId();

    useBeforePaint(() => {
        widths?.set(id, left, right);
    });

    useBeforePaint(() => () => widths?.remove(id), [widths, id]);
    const sharedLeft = useSyncExternalStore(widths?.subscribe ?? NONE, widths?.left ?? ZERO, widths?.left ?? ZERO);
    const sharedRight = useSyncExternalStore(widths?.subscribe ?? NONE, widths?.right ?? ZERO, widths?.right ?? ZERO);

    return [Math.max(left, sharedLeft), Math.max(right, sharedRight)];
}
