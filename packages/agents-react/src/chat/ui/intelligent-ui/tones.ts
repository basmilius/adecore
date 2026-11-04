import type { UiTone } from '@adecore/intelligent-ui';
import type { PillProps } from '@adecore/ui';
import { CircleCheck, Info, MessageCircle, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';

/* Every tone has an icon of its own, so color is never the only thing that tells two apart. */
export const UI_TONE_ICONS: Readonly<Record<UiTone, LucideIcon>> = {
    neutral: MessageCircle,
    info: Info,
    success: CircleCheck,
    warning: TriangleAlert,
    danger: OctagonAlert
};

export const UI_TONE_TEXT: Readonly<Record<UiTone, string>> = {
    neutral: 'text-text-muted',
    info: 'text-status-running',
    success: 'text-positive',
    warning: 'text-status-needs-you',
    danger: 'text-status-error'
};

/* The tone mixed over the ground, for a surface such as a callout. */
export const UI_TONE_SURFACE: Readonly<Record<UiTone, string>> = {
    neutral: 'bg-text/7',
    info: 'bg-status-running/10',
    success: 'bg-positive/10',
    warning: 'bg-status-needs-you/12',
    danger: 'bg-status-error/10'
};

export const UI_TONE_PILL: Readonly<Record<UiTone, NonNullable<PillProps['tone']>>> = {
    neutral: 'muted',
    info: 'accent',
    success: 'idle',
    warning: 'needsYou',
    danger: 'error'
};

/* The tone at full strength, for the square that carries the icon of a Summary. */
export const UI_TONE_FILL: Readonly<Record<UiTone, string>> = {
    neutral: 'bg-text-muted',
    info: 'bg-status-running',
    success: 'bg-positive',
    warning: 'bg-status-needs-you',
    danger: 'bg-status-error'
};

/* The tag at the end of a step, in words, so a state never rests on its icon alone. */
export const UI_STEP_PILL: Readonly<Record<'done' | 'running' | 'pending' | 'failed' | 'skipped', NonNullable<PillProps['tone']>>> = {
    done: 'idle',
    running: 'accent',
    pending: 'muted',
    failed: 'error',
    skipped: 'muted'
};
