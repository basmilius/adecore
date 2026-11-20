import { describe, expect, test } from 'bun:test';
import { Server } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KeyValueListName } from './parts.tsx';

describe('the name in a key value list', () => {
    test('draws a 12px icon before itself when given one', () => {
        const markup = renderToStaticMarkup(<KeyValueListName icon={Server}>Host</KeyValueListName>);
        expect(markup).toMatch(/<dt [^>]*><svg [^>]*width="12"[^>]*>.*<\/svg><span [^>]*>Host<\/span><\/dt>/);
    });

    test('is the name alone without one', () => {
        expect(renderToStaticMarkup(<KeyValueListName>Host</KeyValueListName>)).toMatch(/<dt [^>]*>Host<\/dt>/);
    });
});
