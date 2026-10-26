import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';
import { Kbd } from './Kbd.tsx';
import type { Shortcut } from './shortcut.ts';

export interface TileProps extends Omit<ComponentProps<'button'>, 'title'> {
    icon: ReactNode;
    title: string;
    description?: ReactNode;
    shortcut?: Shortcut;

    /* The one tile a screen leads with. */
    primary?: boolean;

    size?: 'md' | 'sm';
}

export function Tile({ icon, title, description, shortcut, primary = false, size = 'md', className, type = 'button', ...rest }: TileProps) {
    return (
        <button
            type={type}
            className={clsx(
                'flex min-w-0 items-center border bg-surface text-left hover:bg-surface-hover-edged disabled:opacity-50 disabled:hover:bg-surface',
                size === 'md' ? 'gap-3 rounded-xl p-3' : 'gap-2 rounded-lg px-2 py-1.5',
                primary ? 'border-accent' : 'border-border',
                className
            )}
            {...rest}
        >
            <span
                className={clsx(
                    'grid size-8 shrink-0 place-items-center rounded-lg',
                    primary ? 'bg-accent text-accent-text' : 'bg-surface-sunken text-text-muted dark:bg-field dark:inset-ring dark:inset-ring-field-border'
                )}
            >
                {icon}
            </span>
            <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-sm font-medium text-text">{title}</span>
                {description && <span className="truncate text-xs text-text-muted">{description}</span>}
            </span>
            {shortcut && <Kbd shortcut={shortcut} variant="inline" className="shrink-0" />}
        </button>
    );
}
