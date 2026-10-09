import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UiViewNode } from '@adecore/intelligent-ui';
import { Skeleton } from '@adecore/ui';
import { uiBlockHead } from './node-text';
import { UiHeadContext } from './render-context';
import { UiBlockFooter, type UiBlockFooterProps } from './UiBlockFooter';

export interface UiBlockFrameProps extends UiBlockFooterProps {
    /* The evaluated top-level nodes, read for the Summary that heads the block. */
    nodes: readonly UiViewNode[];
    phase: 'streaming' | 'final';
    /* The rendered nodes, or the markdown of the whole block when it is shown as text. */
    children: ReactNode;
    className?: string;
}

/* The tallest the card has been, while `active`: a streaming block grows and never shrinks until its last compile. */
function useRisingFloor(active: boolean): [RefObject<HTMLDivElement | null>, number] {
    const ref = useRef<HTMLDivElement>(null);
    const [floor, setFloor] = useState(0);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!active || element === null) {
            return;
        }
        const observer = new ResizeObserver(() => {
            const height = Math.ceil(element.getBoundingClientRect().height);
            setFloor((current) => Math.max(current, height));
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
            setFloor(0);
        };
    }, [active]);
    return [ref, floor];
}

/*
 * The card of one block, with its footer. Named by its Summary and busy while it streams, but never
 * live: reading out every compile would be noise. A node fades in as it arrives, without a stagger,
 * and for a person who asked for less motion it only fades. Until the first node a skeleton holds the
 * place of the head.
 */
export function UiBlockFrame({ nodes, phase, children, className, ...footer }: UiBlockFrameProps) {
    const { t } = useTranslation('agent-chat');
    const streaming = phase === 'streaming';
    const head = uiBlockHead(nodes);
    const [ref, floor] = useRisingFloor(streaming);
    return (
        <UiHeadContext value={head?.id ?? null}>
            <div
                ref={ref}
                role="group"
                aria-label={head === null || head.label === '' ? t('blocks.label') : head.label}
                aria-busy={streaming || undefined}
                className={clsx('flex min-h-11 flex-col rounded-2xl border border-border bg-surface-raised p-2.25', className)}
                style={streaming && floor > 0 ? { minHeight: floor } : undefined}
            >
                <div className="flex flex-col gap-3 *:transition-[opacity,translate] *:duration-160 *:ease-out *:starting:opacity-0 motion-safe:*:starting:translate-y-0.5">
                    {nodes.length === 0 && streaming ? <Skeleton className="mx-2 my-1 w-2/5" /> : children}
                </div>
                <UiBlockFooter {...footer} />
            </div>
        </UiHeadContext>
    );
}
