import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../Icon.tsx';

export type KeyValueListRootProps = useRender.ComponentProps<'dl'> & {
    /* A hairline between rows, for a long list such as the headers of a message. Without it the rows sit close, for a few facts in a card. */
    divided?: boolean;
};

/* Every item is a subgrid of the list, so the names line up across rows and a hairline runs under both columns. */
export function KeyValueListRoot({ divided = false, render, className, ref, ...props }: KeyValueListRootProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'dl',
        props: {
            ...props,
            className: clsx(
                'grid min-w-0 grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-x-3 text-xs',
                divided ? 'divide-y divide-border-soft *:py-1.5' : 'gap-y-1',
                className
            )
        }
    });
}

export type KeyValueListItemProps = useRender.ComponentProps<'div'>;

export function KeyValueListItem({ render, className, ref, ...props }: KeyValueListItemProps) {
    return useRender({ render, ref, defaultTagName: 'div', props: { ...props, className: clsx('col-span-2 grid grid-cols-subgrid', className) } });
}

export type KeyValueListNameProps = useRender.ComponentProps<'dt'> & {
    /* A 12px icon before the name. */
    icon?: LucideIcon;
};

/* The icon is a column of its own, so it never stands alone on a line and a long name wraps beside it. */
export function KeyValueListName({ icon, render, className, ref, children, ...props }: KeyValueListNameProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'dt',
        props: {
            ...props,
            className: clsx('min-w-0 break-words text-text-faint', icon !== undefined && 'flex items-start gap-1.5', className),
            children:
                icon === undefined ? (
                    children
                ) : (
                    <>
                        {/* Centers the 12px icon on the first 20px line. */}
                        <Icon icon={icon} size={12} className="mt-1 shrink-0" />
                        <span className="min-w-0">{children}</span>
                    </>
                )
        }
    });
}

export type KeyValueListValueProps = useRender.ComponentProps<'dd'> & {
    /* A value read back letter by letter, such as a header, an id or a path. */
    mono?: boolean;
};

/* Selectable, unlike the interface around it, so a long value can be copied. */
export function KeyValueListValue({ mono = false, render, className, ref, ...props }: KeyValueListValueProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'dd',
        props: { ...props, className: clsx('min-w-0 break-words text-text select-text', mono && 'font-mono text-code', className) }
    });
}
