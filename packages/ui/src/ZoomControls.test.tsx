import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZoomControls } from './ZoomControls.tsx';

function markupOf(size?: 'md' | 'sm'): string {
    return renderToStaticMarkup(<ZoomControls zoom={0.75} onZoomChange={() => {}} onFitAll={() => {}} {...(size === undefined ? {} : { size })} />);
}

describe('the zoom controls', () => {
    test('stand at the size of a dock unless asked for the small buttons of a toolbar', () => {
        const dock = markupOf();
        const toolbar = markupOf('sm');

        expect(dock).toContain('h-8 min-w-14 rounded-lg');
        expect(dock).not.toContain('icon-btn-sm');
        expect(toolbar).toContain('h-7 min-w-12 rounded-md');
        expect(toolbar.match(/icon-btn icon-btn-sm/g)).toHaveLength(3);
        expect(toolbar).toContain('75%');
    });
});
