import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';

export interface DetailHeaderProps {
    mark: ReactNode;
    title: string;
    subtitle: ReactNode;
    actions?: ReactNode;
    className?: string;
    ref?: Ref<HTMLElement>;
}

/* The head of a detail: a mark, the name, a line under it, and the actions of the thing. */
export function DetailHeader({ mark, title, subtitle, actions, className, ref }: DetailHeaderProps) {
    return (
        <header ref={ref} className={clsx('flex min-w-0 flex-wrap items-start gap-3', className)}>
            {mark}
            <div className="min-w-0 grow basis-48">
                <h3 className="truncate text-lg font-semibold text-text">{title}</h3>
                <div className="flex min-w-0 items-center gap-1.5 text-xs break-words text-text-muted">{subtitle}</div>
            </div>
            {actions}
        </header>
    );
}
