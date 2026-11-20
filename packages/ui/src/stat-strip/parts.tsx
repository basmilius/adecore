import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { CardGround } from '../card/parts.tsx';

export type StatStripRootProps = useRender.ComponentProps<'dl'> & {
    ground?: CardGround;
};

/* The figures wrap onto more rows when the strip is narrow; each draws the hairline on its top and left, which the strip clips where it meets the edge. */
export function StatStripRoot({ ground = 'raised', render, className, ref, ...props }: StatStripRootProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'dl',
        props: {
            ...props,
            className: clsx(
                'flex min-w-0 flex-wrap overflow-hidden rounded-xl border border-border',
                ground === 'raised' ? 'bg-surface-raised' : 'bg-surface',
                className
            )
        }
    });
}

export type StatStripItemProps = Omit<useRender.ComponentProps<'div'>, 'children'> & {
    label: ReactNode;
    value: ReactNode;

    /* A line under the value: what it counts, or how it changed. */
    note?: ReactNode;
};

export function StatStripItem({ label, value, note, render, className, ref, ...props }: StatStripItemProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            ...props,
            className: clsx('min-w-0 flex-1 basis-36 px-4 py-3 shadow-[-1px_-1px_0_var(--border-soft)]', className),
            children: (
                <>
                    <dt className="truncate text-xs text-text-muted">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-text tabular-nums">{value}</dd>
                    {note !== undefined && <dd className="mt-0.5 truncate text-xs text-text-muted">{note}</dd>}
                </>
            )
        }
    });
}
