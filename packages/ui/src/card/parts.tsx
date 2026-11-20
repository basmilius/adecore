import { Collapsible } from '@base-ui/react/collapsible';
import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { use, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon.tsx';
import { IconButton } from '../IconButton.tsx';
import { CardContext, type CardContextValue } from './context.ts';
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
};

/* A container, so what is inside can answer to the card's width rather than the window's. */
export function CardRoot({
    ground = 'raised',
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
            className: clsx('@container min-w-0 rounded-xl border border-border', ground === 'raised' ? 'bg-surface-raised' : 'bg-surface', className),
            children: <CardContext value={card}>{children}</CardContext>
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
};

/* One line. The children sit at the end and hide while the card is folded. */
export function CardHeader({ title, icon, render, className, ref, children, ...props }: CardHeaderProps) {
    const { t } = useTranslation('ui');
    const card = use(CardContext);
    const triggerId = useId();
    const titled = title !== undefined && card !== null;
    const open = card?.open ?? true;
    const trailing = (open && children !== undefined) || card?.collapsible === true;
    const labelled = titled && card.labelledByTitle;
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
            className: clsx('flex min-h-11 min-w-0 items-center gap-2 pr-3 pl-4', className),
            children: (
                <>
                    {icon !== undefined && <Icon icon={icon} size={16} className="shrink-0 text-text-muted" />}
                    {title !== undefined && (
                        <LevelHeading id={card?.titleId} className="min-w-0 truncate text-sm font-medium text-text">
                            {title}
                        </LevelHeading>
                    )}
                    {trailing && (
                        <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-text-muted tabular-nums">
                            {open && children}
                            {card?.collapsible && (
                                <Collapsible.Trigger
                                    id={triggerId}
                                    aria-labelledby={titled ? `${triggerId} ${card.titleId}` : undefined}
                                    render={
                                        <IconButton icon={open ? ChevronDown : ChevronRight} label={open ? t('card.collapse') : t('card.expand')} size="sm" />
                                    }
                                />
                            )}
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

/* Close under a header, which already holds the space above it. */
export function CardBody({ flush = false, render, className, ref, ...props }: CardBodyProps) {
    const card = use(CardContext);

    const element = useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: { ...props, className: clsx('min-w-0', flush ? 'pb-1' : 'p-4 [[data-card-header]+&]:pt-1', className) }
    });

    if (card?.collapsible !== true) {
        return element;
    }

    return <Collapsible.Panel render={element} />;
}
