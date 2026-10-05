import type { ComponentProps } from 'react';
import clsx from 'clsx';
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs';
import { useRender } from '@base-ui-components/react/use-render';
import { withClass } from '../class-name.ts';
import { formatNumber } from '../format/number.ts';

export const TabsRoot = BaseTabs.Root;

/* A strip as wide as its pane that scrolls sideways when the tabs do not fit, rather than wrapping or squeezing them. */
export function TabsList({ className, ...props }: ComponentProps<typeof BaseTabs.List>) {
    return <BaseTabs.List className={withClass('flex items-end gap-4 overflow-x-auto border-b border-border', className)} {...props} />;
}

/* The picked tab is underlined over the strip's own border; the rest are muted until the pointer is on them. */
export function TabsTab({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
    return (
        <BaseTabs.Tab
            className={withClass(
                '-mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 border-transparent text-xs font-medium text-text-muted hover:text-text data-[active]:border-text data-[active]:text-text data-[disabled]:opacity-50',
                className
            )}
            {...props}
        />
    );
}

export const TabsPanel = BaseTabs.Panel;

export type TabsCountProps = Omit<useRender.ComponentProps<'span'>, 'children'> & {
    value: number;
};

/* How much a tab holds, after its label. Nothing at zero: an empty view needs no number to say so. */
export function TabsCount({ value, render, className, ref, ...props }: TabsCountProps) {
    const element = useRender({
        render,
        ref,
        defaultTagName: 'span',
        props: { ...props, children: formatNumber(value), className: clsx('rounded-full bg-surface-sunken px-1.5 text-text-muted tabular-nums', className) }
    });
    return value === 0 ? null : element;
}
