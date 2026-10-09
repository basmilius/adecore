import { CircleCheck, Info, MessageCircle, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { UiTone } from '@adecore/intelligent-ui';
import type { PillProps } from '@adecore/ui';

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
