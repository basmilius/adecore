import type { ReactNode } from 'react';

export interface DetailHeaderProps {
    mark: ReactNode;
    title: string;
    subtitle: ReactNode;
    actions?: ReactNode;
}

/* The head of a detail: a mark, the name, a line under it, and the actions of the thing. */
export function DetailHeader({ mark, title, subtitle, actions }: DetailHeaderProps) {
    return (
        <header className="flex min-w-0 flex-wrap items-start gap-3">
            {mark}
            <div className="min-w-0 grow basis-48">
                <h3 className="truncate text-lg font-semibold text-text">{title}</h3>
                <div className="flex min-w-0 items-center gap-1.5 text-xs break-words text-text-muted">{subtitle}</div>
            </div>
            {actions}
        </header>
    );
}
