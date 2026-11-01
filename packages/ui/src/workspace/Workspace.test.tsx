import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Workspace } from './Workspace.tsx';
import { WorkspaceRail, WorkspaceRailSeparator } from './WorkspaceRail.tsx';

function regionsOf(markup: string): string[] {
    return [...markup.matchAll(/class="(ade-workspace-[a-z-]+)/g)].map((match) => match[1]!);
}

describe('Workspace', () => {
    test('lays the sidebar and the content on the sheet, and the panel and the rail behind it', () => {
        const markup = renderToStaticMarkup(
            <Workspace toolbar="Toolbar" sidebar="Sidebar" sidePanel="Panel" rail={<WorkspaceRail />}>
                Content
            </Workspace>
        );

        expect(regionsOf(markup)).toEqual([
            'ade-workspace-sheet',
            'ade-workspace-sidebar',
            'ade-workspace-center',
            'ade-workspace-toolbar',
            'ade-workspace-content',
            'ade-workspace-side-panel',
            'ade-workspace-rail'
        ]);
    });

    test('says whether a rail stands beside it', () => {
        const markup = renderToStaticMarkup(
            <Workspace
                rail={
                    <WorkspaceRail aria-label="Tools">
                        <WorkspaceRailSeparator />
                    </WorkspaceRail>
                }
            >
                Content
            </Workspace>
        );

        expect(markup).toContain('data-rail="true"');
        expect(markup).toContain(
            '<nav aria-label="Tools" class="ade-workspace-rail"><span aria-hidden="true" class="ade-workspace-rail-separator"></span></nav>'
        );
    });
});
