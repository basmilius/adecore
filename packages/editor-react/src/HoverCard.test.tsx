import './test-setup.ts';
import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DefinitionPlace } from './HoverCard.tsx';

const at = (uri: string, line: number) => ({ uri, range: { start: { line, character: 0 }, end: { line, character: 4 } } });

describe('where a hover card says a definition is', () => {
    test('is only the line when the definition is in the file of the card', () => {
        const markup = renderToStaticMarkup(
            createElement(DefinitionPlace, { definition: at('file:///work/Controller.php', 461), uri: 'file:///work/Controller.php', folder: '/work' })
        );
        expect(markup).toContain('Line 462');
        expect(markup).not.toContain('Controller.php');
    });

    test('is the name of another file and the line, the name cut short before the line', () => {
        const markup = renderToStaticMarkup(
            createElement(DefinitionPlace, {
                definition: at('file:///work/src/MerchantStatisticsBuyersController.php', 461),
                uri: 'file:///work/a.php',
                folder: '/work'
            })
        );
        expect(markup).toContain('<span class="truncate">MerchantStatisticsBuyersController.php</span>');
        expect(markup).toContain('<span class="shrink-0">:462</span>');
    });

    test('is nothing for a definition that is no file, or that is outside the project, such as a stub of the standard library', () => {
        const place = (definition: string, folder: string) =>
            renderToStaticMarkup(createElement(DefinitionPlace, { definition: at(definition, 102), uri: 'file:///work/a.php', folder }));
        expect(place('untitled:1', '/work')).toBe('');
        expect(place('file:///home/.ruimte/language-servers/php-native/storage/stubs/e4f5f6c/standard/standard_9.php', '/work')).toBe('');
        expect(place('file:///work/vendor/acme/lib/src/Collection.php', '/work')).toContain('Collection.php');
        expect(place('file:///elsewhere/Collection.php', '')).toContain('Collection.php');
    });
});
