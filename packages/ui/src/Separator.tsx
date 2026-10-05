import type { Ref } from 'react';
import clsx from 'clsx';

export interface SeparatorProps {
    orientation?: 'vertical' | 'horizontal';
    className?: string;
    ref?: Ref<HTMLSpanElement>;
}

/* A hairline between two groups of controls in a toolbar-like row. It carries no margin of its own.
   The row's gap puts 8px on either side of it, which is what makes the line read as a divider and
   not as a group of its own. Between two groups of menu rows it is `Menu.Separator`. */
export function Separator({ orientation = 'vertical', className, ref }: SeparatorProps) {
    return <span ref={ref} aria-hidden className={clsx(orientation === 'vertical' ? 'h-4 w-px' : 'h-px w-full', 'shrink-0 bg-border', className)} />;
}
