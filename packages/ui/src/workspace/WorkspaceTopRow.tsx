import { useContext, type ComponentProps, type ReactNode } from 'react';
import clsx from 'clsx';
import { TopRowSlotContext } from './context.ts';

export interface WorkspaceTopRowProps extends Omit<ComponentProps<'header'>, 'children'> {
    /** Before the project: room for a window's own controls, and a button that brings the sidebar back. */
    leading?: ReactNode;

    /** The project: a switcher, or a strip of project tabs. */
    children: ReactNode;

    /** Leaves out the slot a lone pane's bar goes into, as beside project tabs, which take the row. */
    slotless?: boolean;
}

/**
 * The 47 pixel band at the top of a `Workspace`'s sheet, as its `toolbar`: the project, and beside it the
 * slot where the bar of a lone pane goes (`useTopRowSlot`, `PaneBar`'s `container`). The window drags by
 * every part of it that is not a control.
 */
export function WorkspaceTopRow({ leading, children, slotless = false, className, ...props }: WorkspaceTopRowProps) {
    const { register } = useContext(TopRowSlotContext);

    return (
        <header
            {...props}
            className={clsx(
                'ade-workspace-top-row relative flex h-[47px] shrink-0 items-center gap-2 bg-surface pr-1.5 pl-2 text-xs text-text-muted',
                className
            )}
        >
            {leading}
            {children}
            {!slotless && <div ref={register} data-top-row-slot="" className="flex h-full min-w-0 grow items-center gap-2" />}
        </header>
    );
}
