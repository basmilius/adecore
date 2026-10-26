import type { Ref } from 'react';
import clsx from 'clsx';
import { line } from 'd3-shape';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { colorOf } from './color.ts';
import { sparkColumns } from './spark.ts';
import type { ChartColor } from './types.ts';

export interface SparklineProps {
    /* A missing value breaks the line, or leaves a column out. */
    readonly values: readonly (number | null)[];
    readonly kind?: 'line' | 'bars';
    /* What the values are, such as "events in 14 days", for the tooltip and a screen reader. */
    readonly label: string;
    readonly tone?: ChartColor;
    /* Writes the total. */
    readonly format?: (value: number) => string;
    readonly width?: number;
    readonly height?: number;
    readonly className?: string;
    readonly ref?: Ref<SVGSVGElement>;
}

/* A small chart without axes, for a row or a tile. Its total is in a tooltip. */
export function Sparkline({ values, kind = 'line', label, tone = 'accent', format = formatNumber, width = 96, height = 24, className, ref }: SparklineProps) {
    const { t } = useTranslation('charts');
    const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const text = t('sparkline', { label, total: format(total) });
    // A line spans the values it has, so a small change reads; columns stand on zero (`sparkColumns`).
    const present = values.filter((value): value is number => value !== null);
    const high = Math.max(...present);
    const low = Math.min(...present);
    const step = values.length > 1 ? (width - 2) / (values.length - 1) : 0;

    const path =
        kind === 'line'
            ? line<number | null>()
                  .defined((value) => value !== null)
                  .x((_, index) => 1 + index * step)
                  .y((value) => 1 + (high === low ? height / 2 : ((high - value!) / (high - low)) * (height - 2)))(values)
            : null;

    return (
        <Tooltip label={text}>
            <svg
                ref={ref}
                width={width}
                height={height}
                role="img"
                aria-label={text}
                tabIndex={0}
                className={clsx('focus-ring block shrink-0 overflow-visible rounded-xs', className)}
                style={{ color: colorOf(tone)! }}
            >
                {kind === 'bars'
                    ? sparkColumns(values, width, height).map((column) => (
                          <rect
                              key={column.x}
                              x={column.x}
                              y={column.y}
                              width={column.width}
                              height={column.height}
                              rx={column.radius}
                              fill={column.zero ? undefined : 'currentColor'}
                              className={column.zero ? 'fill-border-strong' : undefined}
                          />
                      ))
                    : path !== null && <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            </svg>
        </Tooltip>
    );
}
