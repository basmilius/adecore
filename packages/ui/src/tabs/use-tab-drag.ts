import { useRef, useState, type PointerEvent, type RefObject } from 'react';

/* How far a pressed tab moves before it is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;

/* How far above or below the strip a dragged tab goes before it tears off. */
const TEAR_DISTANCE_PX = 24;

/* The width of `.ade-tab-insertion`, and how far outside the first or last tab it stands. */
const INSERTION_WIDTH_PX = 2;
const INSERTION_INSET_PX = 2;

/* A pressed tab: still a click, moving along the strip, out of the strip, or moving the window itself. */
interface Press {
    key: string;
    pointerId: number;
    /* Where in the window the press began, which is where the pointer holds a window the tab goes into. */
    grab: { x: number; y: number };
    mode: 'press' | 'reorder' | 'out' | 'window';
    /* Where among the other tabs a reorder lets the tab go, or null while it would stay where it is. */
    landing: number | null;
}

export interface TabDragOptions {
    /** The keys of the strip in their order, read when a drag needs them. */
    keys(): readonly string[];

    /** Where among the other tabs the tab lands for a drop before the `index`th of them, or null where it stays; pinned tabs keep their own run. */
    landingOf(key: string, index: number): number | null;

    onReorder(key: string, landing: number): void;

    /**
     * The tab leaves the strip while held: pulled `TEAR_DISTANCE` above or below it, or out of the window.
     * `center` is where it is held, at the start of the strip; `width` is its width. Without it a tab stays in the strip.
     */
    onTearOut?(key: string, center: { x: number; y: number }, width: number): void;

    /** A release outside the window, for a platform that cannot follow a tab out while it is held. `at` is where the window would stand on screen. */
    onTearOff?(key: string, at: { x: number; y: number }): void;

    /** Whether dragging this tab moves its window rather than the tab, as for the only tab of a window. */
    dragsWindow?(key: string): boolean;

    onWindowDrag?(key: string, grab: { x: number; y: number }): void;

    /** The pointer let go after a tear-out or a window drag, wherever it was. `window` says it moved the window. */
    onRelease?(key: string, window: boolean): void;
}

export interface TabDrag {
    /** For the element around the tabs, whose box decides when a tab leaves the strip. */
    strip: RefObject<HTMLDivElement | null>;

    /** Where the line that says where the tab lands stands, from the strip's left, or null while there is none. */
    insertion: number | null;

    /** For each tab, which must also carry `data-tab-key`. */
    tabProps(key: string): {
        'data-tab-key': string;
        onPointerDown(event: PointerEvent<HTMLElement>): void;
        onPointerMove(event: PointerEvent<HTMLElement>): void;
        onPointerUp(event: PointerEvent<HTMLElement>): void;
        onPointerCancel(event: PointerEvent<HTMLElement>): void;
        onLostPointerCapture(event: PointerEvent<HTMLElement>): void;
    };
}

/** The place among the other tabs of a strip where a dragged tab lands: before the first one whose middle is right of `x`. */
export function tabDropIndex(strip: Element, key: string, x: number): number {
    const others = [...strip.querySelectorAll<HTMLElement>('[data-tab-key]')].filter((tab) => tab.dataset.tabKey !== key);

    return others.filter((tab) => {
        const box = tab.getBoundingClientRect();

        return box.left + box.width / 2 < x;
    }).length;
}

/* Where in the strip the insertion line stands for a tab landing at `landing` among the others: halfway the gap it goes in. */
function insertionLeft(strip: Element, others: readonly string[], landing: number): number {
    const boxOf = (key: string | undefined) =>
        key === undefined ? null : (strip.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(key)}"]`)?.getBoundingClientRect() ?? null);
    const before = boxOf(others[landing - 1]);
    const after = boxOf(others[landing]);
    const origin = strip.getBoundingClientRect().left;
    const x =
        before !== null && after !== null
            ? (before.right + after.left) / 2
            : after !== null
              ? after.left - INSERTION_INSET_PX
              : (before?.right ?? origin) + INSERTION_INSET_PX;

    return Math.max(0, Math.round(x - origin - INSERTION_WIDTH_PX / 2));
}

function outsideViewport(x: number, y: number): boolean {
    return x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight;
}

/**
 * Pointer handling for a strip of tabs that a person reorders by dragging, and can drag out of the strip into
 * a window of its own. The strip stays put while a tab is held, so the insertion line says where it lands and
 * the drop moves it once. A press on a button inside a tab stays that button's.
 */
export function useTabDrag(options: TabDragOptions): TabDrag {
    const [insertion, setInsertion] = useState<number | null>(null);
    const press = useRef<Press | null>(null);
    const strip = useRef<HTMLDivElement>(null);
    const follows = options.onTearOut !== undefined;

    /*
     * Out of the strip the tab's element may go with it, so the release is heard on the window itself,
     * which keeps the pointer for as long as it is down.
     */
    const awaitRelease = (held: Press): void => {
        const types = ['pointerup', 'mouseup', 'pointercancel'] as const;
        const release = (): void => {
            for (const type of types) {
                removeEventListener(type, release);
            }

            if (press.current === held) {
                press.current = null;
            }

            options.onRelease?.(held.key, held.mode === 'window');
        };

        for (const type of types) {
            addEventListener(type, release);
        }
    };

    const onPointerDown = (event: PointerEvent<HTMLElement>, key: string): void => {
        // A close button inside the tab is a press of its own.
        if (event.button !== 0 || (event.target as Element).closest('button') !== null) {
            return;
        }

        // Held, the pointer keeps reporting to this tab outside the window too, which is where a tab tears off.
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { key, pointerId: event.pointerId, grab: { x: event.clientX, y: event.clientY }, mode: 'press', landing: null };
    };

    const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
        const held = press.current;

        if (held === null || held.pointerId !== event.pointerId) {
            return;
        }

        if (held.mode === 'press') {
            if (Math.hypot(event.clientX - held.grab.x, event.clientY - held.grab.y) < DRAG_THRESHOLD_PX) {
                return;
            }

            if (options.dragsWindow?.(held.key) === true && options.onWindowDrag !== undefined) {
                held.mode = 'window';
                awaitRelease(held);
                options.onWindowDrag(held.key, held.grab);

                return;
            }

            held.mode = 'reorder';
        }

        if (held.mode !== 'reorder') {
            return;
        }

        const box = strip.current?.getBoundingClientRect();
        const offStrip = box !== undefined && (event.clientY < box.top - TEAR_DISTANCE_PX || event.clientY > box.bottom + TEAR_DISTANCE_PX);

        if (follows && (offStrip || outsideViewport(event.clientX, event.clientY))) {
            held.mode = 'out';
            held.landing = null;
            setInsertion(null);
            awaitRelease(held);

            // Held by the middle of its tab, at the start of a strip like this one, until the window it goes into says where its strip is.
            const tab = event.currentTarget.getBoundingClientRect();
            const left = box?.left ?? tab.left;

            options.onTearOut?.(held.key, { x: left + tab.width / 2, y: tab.top + tab.height / 2 }, tab.width);

            return;
        }

        const row = event.currentTarget.parentElement;

        if (row === null || strip.current === null) {
            return;
        }

        held.landing = options.landingOf(held.key, tabDropIndex(row, held.key, event.clientX));

        const others = options.keys().filter((one) => one !== held.key);

        setInsertion(held.landing === null ? null : insertionLeft(strip.current, others, held.landing));
    };

    const onPointerEnd = (event: PointerEvent<HTMLElement>, cancelled: boolean): void => {
        const held = press.current;

        if (held === null || held.pointerId !== event.pointerId || held.mode === 'out' || held.mode === 'window') {
            return;
        }

        press.current = null;
        setInsertion(null);

        if (held.mode !== 'reorder' || cancelled) {
            return;
        }

        if (!follows && options.onTearOff !== undefined && outsideViewport(event.clientX, event.clientY)) {
            options.onTearOff(held.key, { x: event.screenX - held.grab.x, y: event.screenY - held.grab.y });

            return;
        }

        if (held.landing !== null) {
            options.onReorder(held.key, held.landing);
        }
    };

    // A held tab whose element moves, as when a tab from elsewhere drops into the strip, lets go of the capture; it is taken back.
    const onLostPointerCapture = (event: PointerEvent<HTMLElement>): void => {
        const held = press.current;

        if (held === null || held.pointerId !== event.pointerId || (held.mode !== 'press' && held.mode !== 'reorder')) {
            return;
        }

        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            press.current = null;
        }
    };

    return {
        strip,
        insertion,
        tabProps: (key) => ({
            'data-tab-key': key,
            onPointerDown: (event) => onPointerDown(event, key),
            onPointerMove,
            onPointerUp: (event) => onPointerEnd(event, false),
            onPointerCancel: (event) => onPointerEnd(event, true),
            onLostPointerCapture
        })
    };
}
