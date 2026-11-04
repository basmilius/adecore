import clsx from 'clsx';
import type { ReactNode, Ref } from 'react';
import { ScrollArea } from '../ScrollArea.tsx';

const LIST_WIDTHS = { 280: 'w-70', 320: 'w-80', 340: 'w-85' } as const;

export interface MasterDetailProps {
    /* Usually `MasterItem`s under their own headers. */
    list: ReactNode;

    listWidth: keyof typeof LIST_WIDTHS;
    listLabel: string;
    detail: ReactNode;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* Its section must be `split`, so the dialog hands the pane its whole height instead of a padded scrolling column. */
export function MasterDetail({ list, listWidth, listLabel, detail, className, ref }: MasterDetailProps) {
    return (
        <div ref={ref} className={clsx('flex min-h-0 min-w-0 grow border-t border-border max-[640px]:flex-col', className)}>
            <ScrollArea
                render={<nav />}
                aria-label={listLabel}
                className={clsx(
                    'shrink-0 border-r border-border max-[640px]:max-h-60 max-[640px]:w-auto max-[640px]:border-r-0 max-[640px]:border-b',
                    LIST_WIDTHS[listWidth]
                )}
                viewportClassName="flex flex-col gap-0.5 p-2"
            >
                {list}
            </ScrollArea>
            <ScrollArea className="grow">
                <div className="flex min-w-0 flex-col gap-7 px-8 pt-6 pb-10 max-[960px]:px-4">{detail}</div>
            </ScrollArea>
        </div>
    );
}

export interface MasterItemProps {
    selected: boolean;
    onSelect(): void;
    children: ReactNode;
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

export function MasterItem({ selected, onSelect, children, className, ref }: MasterItemProps) {
    return (
        <button
            ref={ref}
            type="button"
            aria-current={selected ? 'true' : undefined}
            className={clsx(
                'flex w-full min-w-0 shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text focus-visible:-outline-offset-2',
                selected ? 'bg-text/5' : 'hover:bg-surface-hover',
                className
            )}
            onClick={onSelect}
        >
            {children}
        </button>
    );
}
