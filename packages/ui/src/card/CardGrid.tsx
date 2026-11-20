import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { use, useId, type ReactNode } from 'react';
import { Icon } from '../Icon.tsx';
import { CardGridContext, HeadingLevelContext, type CardGridColumns, type CardGridFlow, type CardGridPlace } from './context.ts';
import { LevelHeading } from './heading.tsx';

export type { CardGridColumns, CardGridFlow };

export type CardGridProps = Omit<useRender.ComponentProps<'div'>, 'title'> & {
    columns?: CardGridColumns;

    /* `grid` lines the cards up in rows of equal height; `masonry` closes each card up under the one above it. */
    flow?: CardGridFlow;

    /* A heading above the cards, which makes the grid a group of its own. */
    title?: ReactNode;

    icon?: LucideIcon;
};

/*
 * Cards with one gutter both ways, in one column while the grid is narrow (`theme.css`). A grid inside another takes
 * the full row of it, so a titled grid in a grid of one column is a group, and the cards of two groups never share a column.
 */
export function CardGrid({ columns = 2, flow = 'grid', title, icon, render, className, ref, children, ...props }: CardGridProps) {
    const parent = use(CardGridContext);
    const level = use(HeadingLevelContext);
    const titleId = useId();
    const titled = title !== undefined;
    const place: CardGridPlace = { columns, flow };

    return useRender({
        render,
        ref,
        defaultTagName: titled ? 'section' : 'div',
        props: {
            'aria-labelledby': titled ? titleId : undefined,
            ...props,
            'data-columns': columns,
            'data-flow': flow,
            'data-card-span': parent === null ? undefined : 'full',
            className: clsx('ade-card-grid min-w-0', className),
            children: (
                <>
                    {titled && (
                        <LevelHeading id={titleId} className="mb-3 flex min-w-0 items-center gap-2 text-sm font-medium text-text">
                            {icon !== undefined && <Icon icon={icon} size={16} className="shrink-0 text-text-muted" />}
                            <span className="min-w-0 truncate">{title}</span>
                        </LevelHeading>
                    )}
                    <div className="ade-card-grid-cards">
                        <CardGridContext value={place}>
                            <HeadingLevelContext value={titled ? level + 1 : level}>{children}</HeadingLevelContext>
                        </CardGridContext>
                    </div>
                </>
            )
        }
    });
}
