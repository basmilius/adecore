import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { Surface } from './Surface.tsx';

/* How close to the bottom of the window the pointer has to come before a hidden dock slides back. */
const REVEAL_ZONE = 120;

export interface DockShellProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    /* The dock waits below the window's edge until the pointer comes down to it. */
    autoHide?: boolean;
    /* Classes for the bar itself, such as letting a dock with many buttons wrap. */
    barClassName?: string;
    /* Told whenever the bar slides away or comes back, for what stands on top of it. */
    onHiddenChange?: (hidden: boolean) => void;
    ref?: Ref<HTMLDivElement>;
}

/*
 * The floating bar at the bottom of a canvas-like view, and the one place that knows how to get out
 * of the way. With `autoHide` it waits below the edge until the pointer comes down to it, an open
 * menu keeps it up (it would take its own popup with it), and a keyboard reaches it by tabbing. The
 * buttons stay in the tab order while it is out of sight, so focus brings it back. Something that
 * moves with the dock marks itself `data-holds-dock`, so reaching for it does not hide the dock.
 */
export function DockShell({ children, autoHide = false, className, barClassName, onHiddenChange, ref, ...rest }: DockShellProps) {
    const barRef = useRef<HTMLDivElement>(null);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (!autoHide) {
            return;
        }
        let pointerNear = false;
        const evaluate = (): void => {
            const bar = barRef.current;
            const holds = bar !== null && (bar.querySelector('[data-popup-open]') !== null || bar.querySelector(':focus-visible') !== null);
            setRevealed(pointerNear || holds);
        };
        const onMove = (event: PointerEvent): void => {
            /* Something that moves with the dock would slide away under the pointer reaching for it,
               so over one the dock stays as it is. */
            if (event.target instanceof Element && event.target.closest('[data-holds-dock]') !== null) {
                return;
            }
            pointerNear = window.innerHeight - event.clientY <= REVEAL_ZONE;
            evaluate();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('focusin', evaluate);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('focusin', evaluate);
            setRevealed(false);
        };
    }, [autoHide]);

    const hidden = autoHide && !revealed;
    useEffect(() => {
        onHiddenChange?.(hidden);
    }, [hidden, onHiddenChange]);
    return (
        <div ref={ref} {...rest} className={clsx('pointer-events-none absolute inset-x-0 bottom-4 flex justify-center', className)}>
            <Surface
                ref={barRef}
                className={clsx(
                    'flex items-center gap-2 rounded-xl p-1 transition-[opacity,translate] duration-200',
                    barClassName,
                    hidden ? 'pointer-events-none translate-y-6 opacity-0' : 'pointer-events-auto'
                )}
            >
                {children}
            </Surface>
        </div>
    );
}
