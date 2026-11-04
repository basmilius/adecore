import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { TopRowSlotContext, WorkspaceContext, type WorkspaceLayout } from './context.ts';

export interface WorkspaceProps extends useRender.ComponentProps<'div'> {
    layout?: WorkspaceLayout;
    toolbar?: ReactNode;
    sidebar?: ReactNode;
    sidePanel?: ReactNode;

    /** A column at the window's right edge, after the side panel, usually a `WorkspaceRail`. */
    rail?: ReactNode;

    /** Auto-sized regions keep their own width, separators and opening animation. */
    sidebarWidth?: number | 'auto';

    sidePanelWidth?: number | 'auto';
    sidebarOpen?: boolean;
    sidePanelOpen?: boolean;
}

const isPresent = (node: ReactNode): boolean => node !== undefined && node !== null && node !== false;

/** The sidebar, the toolbar and the content on one raised sheet, with the side panel and the rail behind it. */
export function Workspace({
    layout = 'standard',
    toolbar,
    sidebar,
    sidePanel,
    rail,
    sidebarWidth = 248,
    sidePanelWidth = 320,
    sidebarOpen,
    sidePanelOpen,
    children,
    className,
    ref,
    render,
    style,
    ...props
}: WorkspaceProps) {
    const hasSidebar = isPresent(sidebar);
    const hasPanel = isPresent(sidePanel);
    const hasRail = isPresent(rail);
    const leftOpen = hasSidebar && (sidebarOpen ?? true);
    const rightOpen = hasPanel && (sidePanelOpen ?? true);
    const hasToolbar = isPresent(toolbar);
    const [topRowSlot, setTopRowSlot] = useState<HTMLElement | null>(null);

    const element = useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            ...props,
            className: clsx('ade-workspace', className),
            style,
            'data-layout': layout,
            'data-toolbar': hasToolbar || undefined,
            'data-sidebar': leftOpen || undefined,
            'data-side-panel': rightOpen || undefined,
            'data-rail': hasRail || undefined,
            children: (
                <>
                    <div className="ade-workspace-sheet">
                        {hasSidebar && (
                            <aside className="ade-workspace-sidebar" data-auto={sidebarWidth === 'auto' || undefined} style={{ width: sidebarWidth }}>
                                {sidebar}
                            </aside>
                        )}
                        <div className="ade-workspace-center">
                            {hasToolbar && <div className="ade-workspace-toolbar">{toolbar}</div>}
                            <div className="ade-workspace-content">{children}</div>
                        </div>
                    </div>
                    {hasPanel && (
                        <aside className="ade-workspace-side-panel" data-auto={sidePanelWidth === 'auto' || undefined} style={{ width: sidePanelWidth }}>
                            {sidePanel}
                        </aside>
                    )}
                    {hasRail && rail}
                </>
            )
        }
    });

    // The sheet's right edge is rounded, so panes along it keep their corners, whatever stands beside the sheet.
    const context = { layout, edges: { top: !hasToolbar, right: false, bottom: true, left: !leftOpen } };

    return (
        <WorkspaceContext value={context}>
            <TopRowSlotContext value={{ slot: topRowSlot, register: setTopRowSlot }}>{element}</TopRowSlotContext>
        </WorkspaceContext>
    );
}
