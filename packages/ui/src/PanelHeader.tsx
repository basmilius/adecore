import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useRender } from '@base-ui/react/use-render';
import { SectionLabel } from './SectionLabel.tsx';

export type PanelHeaderProps = useRender.ComponentProps<'header'> & {
    /* Left out when the caller lays out the name itself. */
    title?: ReactNode;
};

/* As tall as a 48px toolbar beside it. */
export function PanelHeader({ title, render, className, ref, children, ...props }: PanelHeaderProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'header',
        props: {
            ...props,
            className: clsx('flex h-12 shrink-0 items-center gap-2 border-b border-border pr-2 pl-3', className),
            children: (
                <>
                    {title !== undefined && <SectionLabel className="shrink-0">{title}</SectionLabel>}
                    {children}
                </>
            )
        }
    });
}
