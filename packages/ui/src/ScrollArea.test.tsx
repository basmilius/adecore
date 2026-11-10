import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollArea } from './ScrollArea.tsx';

describe('a scroll area', () => {
    test('hands its content and props to the viewport and hides its bars from assistive tech', () => {
        const markup = renderToStaticMarkup(
            <ScrollArea axis="both" className="h-40" viewportClassName="p-2" role="listbox" tabIndex={0}>
                <p>Rows</p>
            </ScrollArea>
        );

        expect(markup).toContain('class="ade-scroll-area h-40"');
        expect(markup).toMatch(/<div role="listbox" tabindex="0" data-axis="both" class="ade-scroll-viewport p-2"><p>Rows<\/p><\/div>/);
        expect(markup.match(/aria-hidden="true" class="ade-scrollbar"/g)).toHaveLength(2);
    });

    test('scrolls the element it is told to render, such as a pre', () => {
        const markup = renderToStaticMarkup(
            <ScrollArea render={<pre />} viewportClassName="p-2">
                text
            </ScrollArea>
        );

        expect(markup).toContain('<pre data-axis="y" class="ade-scroll-viewport p-2">text</pre>');
    });

    test('ends its bars above a layer that covers its bottom', () => {
        expect(renderToStaticMarkup(<ScrollArea coveredBottom={80} />)).toContain('class="ade-scroll-area" style="--scrollbar-covered-bottom:80px"');
        expect(renderToStaticMarkup(<ScrollArea coveredBottom={0} />)).not.toContain('style=');
    });

    test('draws only the bar of the axis it scrolls in', () => {
        expect(renderToStaticMarkup(<ScrollArea />)).toContain('data-orientation="vertical"');
        expect(renderToStaticMarkup(<ScrollArea />)).not.toContain('data-orientation="horizontal"');
        expect(renderToStaticMarkup(<ScrollArea axis="x" />)).not.toContain('data-orientation="vertical"');
    });
});
