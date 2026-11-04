import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import { useState, type CSSProperties, type Ref } from 'react';
import { mergeRefs } from './merge-refs.ts';
import { useOverlayScrollbars, type ScrollAreaAxis } from './useOverlayScrollbars.tsx';

export type ScrollAreaProps = Omit<useRender.ComponentProps<'div'>, 'className' | 'ref'> & {
    /* The directions the content scrolls in; the other one clips. */
    axis?: ScrollAreaAxis;

    /* The outer box, which holds the bars and takes the size. */
    className?: string;
    ref?: Ref<HTMLDivElement>;

    /* The element that scrolls, for a virtualizer or code that sets the scroll position. */
    viewportRef?: Ref<HTMLElement>;

    /* Padding and layout of the content. `render` and the remaining props land on the viewport too. */
    viewportClassName?: string;

    /* Pixels of the bottom edge a layer over the area covers, such as a docked input. The bars end above it. */
    coveredBottom?: number;
};

/* A box that scrolls natively under thin bars that float over its content and show only while it scrolls. */
export function ScrollArea({ axis = 'y', className, viewportClassName, viewportRef, coveredBottom, ref, render, ...props }: ScrollAreaProps) {
    const [viewport, setViewport] = useState<HTMLElement | null>(null);
    const scrollbars = useOverlayScrollbars(viewport, { axis });

    const content = useRender<Record<string, never>, HTMLElement>({
        render,
        ref: mergeRefs<HTMLElement>(setViewport, viewportRef),
        defaultTagName: 'div',
        props: { ...props, 'data-axis': axis, className: clsx('ade-scroll-viewport', viewportClassName) }
    });

    return (
        <div
            ref={ref}
            className={clsx('ade-scroll-area', className)}
            style={coveredBottom ? ({ '--scrollbar-covered-bottom': `${coveredBottom}px` } as CSSProperties) : undefined}
        >
            {content}
            {scrollbars}
        </div>
    );
}
