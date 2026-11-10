import clsx from 'clsx';
import type { Ref } from 'react';
import { useWindowControlsInset } from './window-controls.ts';

export interface WindowControlsSpacerProps {
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* A box as wide as the window's own controls, such as the traffic lights, at the start of a header. Nothing where there are none. */
export function WindowControlsSpacer({ className, ref }: WindowControlsSpacerProps) {
    const inset = useWindowControlsInset();

    if (inset === undefined) {
        return null;
    }

    return <div ref={ref} aria-hidden className={clsx('shrink-0 self-stretch', className)} style={{ width: inset }} />;
}
