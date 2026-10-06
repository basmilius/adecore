import './test-setup.ts';
import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DefinitionPlace } from './HoverCard.tsx';

const at = (uri: string, line: number) => ({ uri, range: { start: { line, character: 0 }, end: { line, character: 4 } } });

describe('where a hover card says a definition is', () => {
    test('is only the line when the definition is in the file of the card', () => {
        const markup = renderToStaticMarkup(
            createElement(DefinitionPlace, { definition: at('file:///work/Controller.php', 461), uri: 'file:///work/Controller.php' })
        );
        expect(markup).toContain('Line 462');
        expect(markup).not.toContain('Controller.php');
    });

    test('is the name of another file and the line, the name cut short before the line', () => {
        const markup = renderToStaticMarkup(
            createElement(DefinitionPlace, { definition: at('file:///work/src/MerchantStatisticsBuyersController.php', 461), uri: 'file:///work/a.php' })
        );
        expect(markup).toContain('<span class="truncate">MerchantStatisticsBuyersController.php</span>');
        expect(markup).toContain('<span class="shrink-0">:462</span>');
    });

    test('is nothing for a definition that is no file', () => {
        expect(renderToStaticMarkup(createElement(DefinitionPlace, { definition: at('untitled:1', 0), uri: 'file:///work/a.php' }))).toBe('');
    });
});
