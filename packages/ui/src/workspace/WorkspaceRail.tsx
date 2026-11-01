import clsx from 'clsx';
import { useRender } from '@base-ui/react/use-render';

export type WorkspaceRailProps = useRender.ComponentProps<'nav'>;

/**
 * The column of buttons at the right edge of a `Workspace`, 48 pixels wide. Its first separator stands on
 * the toolbar's bottom line when one 32 pixel button comes before it. It makes no stacking context, so a
 * hover never covers the sheet's edge; a tooltip still rises above the sheet.
 */
export function WorkspaceRail({ className, render, ref, ...props }: WorkspaceRailProps) {
    return useRender({ render, ref, defaultTagName: 'nav', props: { ...props, className: clsx('ade-workspace-rail', className) } });
}

export function WorkspaceRailSeparator({ className }: { className?: string }) {
    return <span aria-hidden className={clsx('ade-workspace-rail-separator', className)} />;
}

/** Pushes what follows to the bottom of the rail. */
export function WorkspaceRailSpacer() {
    return <span aria-hidden className="ade-workspace-rail-spacer" />;
}
