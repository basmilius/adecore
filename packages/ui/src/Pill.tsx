import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';

/*
 * What the label says about the thing it names, drawn as its ground. Every ground is an alpha over
 * whatever the pill stands on, the way a border is: in the dark theme it lifts a shade off the row
 * under it, in the light theme it sinks one. A solid sunken ground read as a hole on a dark row.
 */
const TONES = {
    muted: 'bg-text/7 text-text-muted',
    /* A step further off the ground, for a label that should stand out as a control. */
    raised: 'bg-text/12 text-text-muted',
    idle: 'bg-status-idle/15 text-status-idle',
    needsYou: 'bg-status-needs-you/15 text-status-needs-you',
    error: 'bg-status-error/15 text-status-error',
    accent: 'bg-accent/16 text-accent'
};

/* The corners of a button, so a pill reads as a small label of the same family and not as a badge. A tag, at the end of a line of prose, is tighter and heavier. */
const SHAPES = {
    pill: 'rounded-md',
    tag: 'rounded-md font-medium'
};

/* The text stays at the theme's smallest size, so `sm` gives up padding: 20px tall instead of 24. */
const PADDING = {
    pill: { md: 'px-2 py-0.5', sm: 'px-1.5' },
    tag: { md: 'px-1.5 py-0.5', sm: 'px-1' }
};

export interface PillProps {
    icon?: ReactNode;
    children: ReactNode;
    tone?: keyof typeof TONES;
    shape?: keyof typeof SHAPES;
    size?: 'md' | 'sm';
    /* A branch name or a count reads better in the monospace face. */
    mono?: boolean;
    /* With a handler the pill is a button; without one it is a label. */
    onClick?: () => void;
    /* Makes the button a toggle, for a switch of what a surface shows. */
    pressed?: boolean;
    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLElement>;
}

/* The small rounded label in a header, a sidebar row or a settings line: a count, a branch, a status. */
export function Pill({ icon, children, tone = 'muted', shape = 'pill', size = 'md', mono = false, onClick, pressed, disabled, className, ref }: PillProps) {
    // Never broken inside itself: in a row that wraps, a pill that does not fit moves to the next line whole.
    const shared = clsx(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-2xs',
        SHAPES[shape],
        PADDING[shape][size],
        TONES[tone],
        mono && 'font-mono',
        className
    );
    if (!onClick) {
        return (
            <span ref={ref} className={shared}>
                {icon}
                {children}
            </span>
        );
    }
    return (
        <button
            ref={ref as Ref<HTMLButtonElement>}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            className={clsx(shared, 'enabled:hover:text-text disabled:opacity-50 aria-pressed:bg-text/14 aria-pressed:text-text')}
            onClick={onClick}
        >
            {icon}
            {children}
        </button>
    );
}
