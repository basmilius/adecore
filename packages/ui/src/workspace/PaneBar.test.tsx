import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { tabDropIndex } from '../tabs/use-tab-drag.ts';
import { PaneBar } from './PaneBar.tsx';
import { Workspace } from './Workspace.tsx';
import { WorkspaceTopRow } from './WorkspaceTopRow.tsx';

describe('PaneBar', () => {
    test('draws the title, the actions and a close button, and is no drag handle without a drag', () => {
        const markup = renderToStaticMarkup(
            <PaneBar title="Notes" actions={<button type="button">Save</button>} onClose={() => undefined} closeLabel="Close cell" />
        );

        expect(markup).toContain('data-pane-bar=""');
        expect(markup).toContain('<span data-pane-title=""');
        expect(markup).toContain('>Notes</span>');
        expect(markup).toContain('>Save</button>');
        expect(markup).toContain('aria-label="Close cell"');
        expect(markup).not.toContain('draggable="true"');
    });

    test('is a drag handle with a drag', () => {
        expect(renderToStaticMarkup(<PaneBar title="Notes" onDragStart={() => undefined} />)).toContain('draggable="true"');
    });

    test('puts the actions of a pane with tabs in a bar of their own, unless they are compact', () => {
        const actions = <button type="button">Run</button>;

        expect(renderToStaticMarkup(<PaneBar title="Tabs" tabs actions={actions} />)).toContain('data-pane-actions=""');
        expect(renderToStaticMarkup(<PaneBar title="Tabs" tabs compactActions actions={actions} />)).not.toContain('data-pane-actions=""');
    });
});

describe('WorkspaceTopRow', () => {
    test('holds the project and a slot for a lone pane, unless it has none', () => {
        const draw = (slotless: boolean) =>
            renderToStaticMarkup(<Workspace toolbar={<WorkspaceTopRow slotless={slotless}>Passly</WorkspaceTopRow>}>Content</Workspace>);

        expect(draw(false)).toContain('data-top-row-slot=""');
        expect(draw(false)).toContain('Passly');
        expect(draw(true)).not.toContain('data-top-row-slot=""');
    });
});

describe('tabDropIndex', () => {
    // Tabs of 100 pixels side by side, read the way the strip reads them.
    const strip = (keys: readonly string[]) =>
        ({
            querySelectorAll: () => keys.map((key, index) => ({ dataset: { tabKey: key }, getBoundingClientRect: () => ({ left: index * 100, width: 100 }) }))
        }) as unknown as Element;

    test('counts the other tabs whose middle is left of the pointer', () => {
        expect(tabDropIndex(strip(['a', 'b', 'c']), 'a', 10)).toBe(0);
        expect(tabDropIndex(strip(['a', 'b', 'c']), 'a', 160)).toBe(1);
        expect(tabDropIndex(strip(['a', 'b', 'c']), 'c', 290)).toBe(2);
    });
});
