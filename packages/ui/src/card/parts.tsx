import { Collapsible } from '@base-ui/react/collapsible';
import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { use, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon.tsx';
import { IconButton } from '../IconButton.tsx';
import { CardContext, CardGridContext, cardSpan, type CardContextValue, type CardSpan } from './context.ts';
import { LevelHeading } from './heading.tsx';

export type CardGround = 'raised' | 'surface';

export type CardRootProps = useRender.ComponentProps<'section'> & {
    /* `surface` for a card on a raised ground of its own, such as a dialog. */
    ground?: CardGround;

    /* Folds the body away behind the header, for something a screen does not need at first sight. */
    collapsible?: boolean;

    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;

    /* The columns of a `CardGrid` it takes: a number, or `full` for the whole row. */
    span?: CardSpan;
};

/* A container, so what is inside can answer to the card's width rather than the window's. */
export function CardRoot({
    ground = 'raised',
    span,
    collapsible = false,
    open: openProp,
    defaultOpen = true,
    onOpenChange,
    render,
    className,
    ref,
    children,
    ...props
}: CardRootProps) {
    const grid = use(CardGridContext);
    const titleId = useId();
    const section = useRef<HTMLElement>(null);
    const [ownOpen, setOwnOpen] = useState(defaultOpen);
    const open = !collapsible || (openProp ?? ownOpen);

    const card: CardContextValue = {
        titleId,
        collapsible,
        open,
        section,
        labelledByTitle: props['aria-labelledby'] === undefined && props['aria-label'] === undefined
    };

    const changeOpen = (next: boolean) => {
        setOwnOpen(next);
        onOpenChange?.(next);
    };

    const element = useRender({
        render,
        ref: [section, ref ?? null],
        defaultTagName: 'section',
        props: {
            ...props,
            'data-card-span': cardSpan(span, grid),
            className: clsx(
                '@container flex min-w-0 flex-col rounded-xl border border-border',
                ground === 'raised' ? 'bg-surface-raised' : 'bg-surface',
                className
            ),
            // A card or grid inside this card stands in the card, not in the grid around it.
            children: (
                <CardGridContext value={null}>
                    <CardContext value={card}>{children}</CardContext>
                </CardGridContext>
            )
        }
    });

    if (!collapsible) {
        return element;
    }

    return <Collapsible.Root open={open} onOpenChange={changeOpen} render={element} />;
}

export type CardHeaderProps = Omit<useRender.ComponentProps<'header'>, 'title'> & {
    title?: ReactNode;
    icon?: LucideIcon;

    /* Where a collapsible card draws its toggle: before the icon and title, or after the children. */
    toggle?: 'start' | 'end';
};

/* One line. The children sit at the end and hide while the card is folded. */
export function CardHeader({ title, icon, toggle = 'end', render, className, ref, children, ...props }: CardHeaderProps) {
    const { t } = useTranslation('ui');
    const card = use(CardContext);
    const triggerId = useId();
    const titled = title !== undefined && card !== null;
    const open = card?.open ?? true;
    const collapsible = card?.collapsible === true;
    const toggleAtStart = collapsible && toggle === 'start';
    const toggleAtEnd = collapsible && toggle === 'end';
    const trailing = (open && children !== undefined) || toggleAtEnd;
    const labelled = titled && card.labelledByTitle;

    const toggleButton = collapsible && (
        <Collapsible.Trigger
            id={triggerId}
            aria-labelledby={titled ? `${triggerId} ${card.titleId}` : undefined}
            render={<IconButton icon={open ? ChevronDown : ChevronRight} label={open ? t('card.collapse') : t('card.expand')} size="sm" />}
        />
    );

    const sectionRef = card?.section;
    const titleId = card?.titleId;

    // Only a header knows whether the card has a title, and the section must not point at a heading that is not there.
    useEffect(() => {
        const section = sectionRef?.current;

        if (!labelled || !section || titleId === undefined) {
            return;
        }

        section.setAttribute('aria-labelledby', titleId);

        return () => section.removeAttribute('aria-labelledby');
    }, [labelled, sectionRef, titleId]);

    return useRender({
        render,
        ref,
        defaultTagName: 'header',
        props: {
            ...props,
            'data-card-header': '',
            className: clsx('ade-card-line flex min-w-0 items-center gap-2', className),
            children: (
                <>
                    {toggleAtStart && toggleButton}
                    {icon !== undefined && <Icon icon={icon} size={16} className="shrink-0 text-text-muted" />}
                    {title !== undefined && (
                        <LevelHeading id={card?.titleId} className="min-w-0 truncate text-sm font-medium text-text">
                            {title}
                        </LevelHeading>
                    )}
                    {trailing && (
                        <div className="ade-card-end ml-auto flex shrink-0 items-center gap-2 text-xs text-text-muted tabular-nums">
                            {open && children}
                            {toggleAtEnd && toggleButton}
                        </div>
                    )}
                </>
            )
        }
    });
}

export type CardBodyProps = useRender.ComponentProps<'div'> & {
    /* Runs to the edges, for a table or a list whose rows carry their own padding. */
    flush?: boolean;
};

/*
 * Close under a header, which already holds the space above it. A column that takes the height a grid stretches the card
 * to, so a chart or a list inside can fill or scroll it.
 */
export function CardBody({ flush = false, render, className, ref, ...props }: CardBodyProps) {
    const card = use(CardContext);

    const element = useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            ...props,
            className: clsx('flex min-h-0 min-w-0 grow flex-col', flush ? 'pb-1' : 'p-4 [[data-card-header]+&]:pt-1', className)
        }
    });

    if (card?.collapsible !== true) {
        return element;
    }

    return <Collapsible.Panel render={element} />;
}

export type CardFooterProps = useRender.ComponentProps<'footer'>;

/* One line at the bottom edge, also of a card a grid stretches: a summary, a link to more, actions. Folds away with the body. */
export function CardFooter({ render, className, ref, ...props }: CardFooterProps) {
    const card = use(CardContext);

    const element = useRender({
        render,
        ref,
        defaultTagName: 'footer',
        props: {
            ...props,
            // `box-content` keeps the line 44px tall under its hairline, so a box in it is as far from the line as from the edge.
            className: clsx(
                'ade-card-line ade-card-footer mt-auto box-content flex min-w-0 items-center gap-2 border-t border-border-soft text-xs text-text-muted tabular-nums first:border-t-0',
                className
            )
        }
    });

    if (card?.open === false) {
        return null;
    }

    return element;
}
