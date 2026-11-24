import type { UiProps } from '@adecore/intelligent-ui';
import { Icon, Pill } from '@adecore/ui';
import clsx from 'clsx';
import { Minus, Plus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { uiChildrenOf } from '../node-text';
import type { UiRendererProps } from '../render-context';

/* Cards side by side, stacked in a narrow block; three stand in one row only where the block is wide enough for them. */
export function AlternativesRenderer({ node, children }: UiRendererProps<UiProps<'Alternatives'>>) {
    const { t } = useTranslation('agent-chat');
    const count = uiChildrenOf(node, 'Alternative').length;

    return (
        <div role="group" aria-label={t('blocks.alternatives.label', { count })} className="@container">
            <div className={clsx('chat-ui-nodes grid gap-2 @min-[420px]:grid-cols-2', count === 3 && '@min-[640px]:grid-cols-3')}>{children}</div>
        </div>
    );
}

/*
 * It only shows: a person chooses with a Choice under it. The description and the points come in the order
 * they were written, so the first point keeps its distance from the words above it by its place among them.
 */
export function AlternativeRenderer({ node, children }: UiRendererProps<UiProps<'Alternative'>>) {
    const { t } = useTranslation('agent-chat');
    const { title, recommended } = node.props;

    return (
        <section
            aria-label={title}
            className={clsx('flex min-w-0 flex-col gap-2 rounded-xl bg-ui-tile p-3', recommended === true && 'ring-2 ring-accent ring-inset')}
        >
            <div className="flex items-start gap-2">
                <div className="min-w-0 grow text-xs font-semibold wrap-break-word text-text">{title}</div>
                {recommended === true && (
                    <Pill shape="tag" size="sm" tone="accent" className="shrink-0">
                        {t('blocks.alternatives.recommended')}
                    </Pill>
                )}
            </div>
            <div className="text-xs wrap-break-word text-text-muted [&>div]:mt-1 [&>div:first-of-type]:mt-2">{children}</div>
        </section>
    );
}

function Point({ icon, tone, said, children }: { icon: LucideIcon; tone: string; said: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-1.5 text-2xs text-text">
            <Icon icon={icon} size={12} className={clsx('mt-1 shrink-0', tone)} />
            <span className="sr-only">{said}</span>
            <span className="min-w-0">{children}</span>
        </div>
    );
}

export function ProRenderer({ children }: UiRendererProps<UiProps<'Pro'>>) {
    const { t } = useTranslation('agent-chat');

    return (
        <Point icon={Plus} tone="text-positive" said={t('blocks.alternatives.pro')}>
            {children}
        </Point>
    );
}

export function ConRenderer({ children }: UiRendererProps<UiProps<'Con'>>) {
    const { t } = useTranslation('agent-chat');

    return (
        <Point icon={Minus} tone="text-status-error" said={t('blocks.alternatives.con')}>
            {children}
        </Point>
    );
}
