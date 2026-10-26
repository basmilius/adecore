import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../Icon.tsx';
import { mergeRefs } from '../merge-refs.ts';
import { useSettingsTarget } from './target.ts';

/* How long a row a search result jumped to stays lit. */
const TARGET_MS = 1600;

export interface SettingsRowProps {
    label: ReactNode;
    description?: ReactNode;

    /* It carries its own accessible name. */
    control?: ReactNode;

    /* Under the label line, at the whole width. */
    children?: ReactNode;

    /* For a row that only shows state. */
    muted?: boolean;

    /* Held to the label's first line (`TopIcon`) or a tile of its own. */
    leading?: ReactNode;

    /* For a row that only makes sense under the one above it. */
    indent?: boolean;

    /* The id a search result names to lead here. */
    searchId?: string;

    className?: string;
    ref?: Ref<HTMLDivElement>;
}

export interface TopIconProps {
    icon: LucideIcon;
    size?: number;
    className?: string;
    ref?: Ref<HTMLSpanElement>;
}

/* The box is one line of `text-sm` high, so the icon sits on the first line of text that may wrap. */
export function TopIcon({ icon, size = 16, className, ref }: TopIconProps) {
    return (
        <span ref={ref} className="flex h-5.5 shrink-0 items-center">
            <Icon icon={icon} size={size} className={className} />
        </span>
    );
}

/* Where label and control do not fit side by side, the control wraps under the label instead of widening the dialog. */
export function SettingsRow({ label, description, control, children, muted = false, leading, indent = false, searchId, className, ref }: SettingsRowProps) {
    const row = useRef<HTMLDivElement>(null);
    const { target, shown } = useSettingsTarget();
    const targeted = searchId !== undefined && target === searchId;

    useEffect(() => {
        if (!targeted) {
            return;
        }

        row.current?.scrollIntoView({ block: 'center' });
        const timer = window.setTimeout(shown, TARGET_MS);

        return () => window.clearTimeout(timer);
    }, [targeted, shown]);

    return (
        <div
            ref={mergeRefs(row, ref)}
            data-settings-row={searchId}
            className={clsx(
                'flex min-w-0 flex-col gap-3 pr-4.5 transition-colors duration-500 first:rounded-t-xl last:rounded-b-xl',
                indent ? 'pl-14.5' : 'pl-4.5',
                description || children || leading ? 'py-3.5' : 'py-3',
                targeted && 'bg-accent-soft duration-0',
                className
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex min-w-0 grow basis-60 items-start gap-3">
                    {leading}
                    <div className="min-w-0 grow">
                        <div className={clsx('text-sm break-words', muted ? 'text-text-muted' : 'text-text')}>{label}</div>
                        {description && <div className="mt-0.5 text-xs break-words text-text-muted">{description}</div>}
                    </div>
                </div>
                {control && <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">{control}</div>}
            </div>
            {children}
        </div>
    );
}
