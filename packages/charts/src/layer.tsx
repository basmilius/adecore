import { useState, type ReactNode, type Ref } from 'react';
import { GroupContext, useChartContext } from './context.ts';
import { createAxisWidths } from './group-axes.ts';
import type { ChartX } from './types.ts';

export interface ChartLayerProps {
    readonly children?: ReactNode;
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

export interface ChartGroupProps {
    /* One cursor for every chart inside: the pointer over one draws it in all, with the tooltip only in that one. */
    readonly shareCursor?: boolean;
    /* The y axes take the width of the widest on each side, so the plots start and end at the same pixel. */
    readonly alignAxes?: boolean;
    readonly children?: ReactNode;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/* A `<g>` in the plot for a drawing of the app's own, above the series. */
export function ChartLayer({ children, className, ref }: ChartLayerProps) {
    useChartContext('Chart.Layer');

    return (
        <g ref={ref} className={className}>
            {children}
        </g>
    );
}

/* Charts that share the x under the pointer, each taking its own bucket at it, and line up their plots. */
export function ChartGroup({ shareCursor = true, alignAxes = true, children, className, ref }: ChartGroupProps) {
    const [cursor, setCursor] = useState<{ x: ChartX | null; owner: string | null }>({ x: null, owner: null });
    const [widths] = useState(createAxisWidths);

    const setX = (x: ChartX | null, owner: string): void => setCursor({ x, owner: x === null ? null : owner });

    return (
        <GroupContext value={{ cursor: shareCursor ? { ...cursor, setX } : null, widths: alignAxes ? widths : null }}>
            <div ref={ref} className={className}>
                {children}
            </div>
        </GroupContext>
    );
}
