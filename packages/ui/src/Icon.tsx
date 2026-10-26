import type { Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

// The whole client draws at this weight. 2 is Lucide's default, but at 12 and 14 pixels next to
// text of the same size a hair thinner keeps the glyph from outweighing the words beside it.
const STROKE_WIDTH = 1.75;

export interface IconProps {
    icon: LucideIcon;
    size?: number;
    className?: string;
    ref?: Ref<SVGSVGElement>;
}

/* Decorative: the name a screen reader reads sits on the button or the label next to it. */
export function Icon({ icon: Glyph, size = 16, className, ref }: IconProps) {
    // An inline svg sits on the text baseline, which drops a square glyph below the words next to it.
    return <Glyph ref={ref} size={size} strokeWidth={STROKE_WIDTH} className={clsx('align-middle', className)} aria-hidden />;
}
