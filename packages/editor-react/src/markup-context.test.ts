import { describe, expect, test } from 'bun:test';
import { markupPlaceAt, markupSyntaxOf, tagPairAt, type MarkupSyntax } from './markup-context.ts';

/* The place at the `|` of `marked`, which is left out of the text. */
function placeAt(marked: string, syntax: MarkupSyntax = 'html') {
    const offset = marked.indexOf('|');
    return markupPlaceAt(marked.slice(0, offset) + marked.slice(offset + 1), offset, syntax);
}

function openAt(marked: string, syntax: MarkupSyntax = 'html'): string[] | null {
    const place = placeAt(marked, syntax);
    return place?.kind === 'text' ? place.open.map((element) => element.name) : null;
}

describe('markupSyntaxOf', () => {
    test('knows the markup languages and nothing else', () => {
        expect(markupSyntaxOf('html')).toBe('html');
        expect(markupSyntaxOf('svg')).toBe('xml');
        expect(markupSyntaxOf('vue')).toBe('vue');
        expect(markupSyntaxOf('php')).toBe('php');
        expect(markupSyntaxOf('typescript')).toBeNull();
    });
});

describe('markupPlaceAt', () => {
    test('follows the open elements of the text', () => {
        expect(openAt('<div><p>a</p><ul><li>|')).toEqual(['div', 'ul', 'li']);
        expect(openAt('<div><br><img src="x"><span/>|')).toEqual(['div']);
    });

    test('lets an end tag close the elements left open inside it', () => {
        expect(openAt('<div><p>one</div>|')).toEqual([]);
        expect(openAt('<DIV><p></div>|')).toEqual([]);
    });

    test('reads XML with its case and without void elements', () => {
        expect(openAt('<svg><br>|', 'xml')).toEqual(['svg', 'br']);
        expect(openAt('<Item></item>|', 'xml')).toEqual(['Item']);
    });

    test('tells a tag, its name and a quoted value', () => {
        expect(placeAt('<div class="a"|>')).toEqual({
            kind: 'tag',
            tag: { start: 0, closing: false, name: 'div', nameFrom: 1, nameTo: 4, inValue: false }
        });
        expect(placeAt('<a title="x|>y">')).toMatchObject({ kind: 'tag', tag: { name: 'a', inValue: true } });
        expect(placeAt('<div></di|v>')).toMatchObject({ kind: 'tag', tag: { closing: true, name: 'div' } });
    });

    test('keeps comments, raw elements and doctypes out of the text', () => {
        expect(placeAt('<!-- <div>| -->')?.kind).toBe('other');
        expect(placeAt('<script>if (a < b) {|}</script>')?.kind).toBe('other');
        expect(placeAt('<!DOCTYPE html|>')?.kind).toBe('other');
        expect(openAt('<script>let a = "<div>"</script><p>|')).toEqual(['p']);
    });

    test('keeps the code of PHP and the interpolations of Vue out of the text', () => {
        expect(placeAt('<div><?php if ($a > 1) {| ?>', 'php')?.kind).toBe('other');
        expect(openAt('<div><?php echo "<p>"; ?>|', 'php')).toEqual(['div']);
        expect(placeAt('<p class="<?= $a |?>">', 'php')?.kind).toBe('other');
        expect(placeAt('<template><p>{{ a |}}</p></template>', 'vue')?.kind).toBe('other');
        expect(openAt('<template><p>{{ a }}|', 'vue')).toEqual(['template', 'p']);
    });

    test('reads nothing in a document too large for a keystroke', () => {
        expect(markupPlaceAt(' '.repeat(1_000_001), 0, 'html')).toBeNull();
    });
});

describe('tagPairAt', () => {
    test('pairs the names of a start tag and the end tag that closes it, from either one', () => {
        const text = '<div><div>a</div></div>';
        expect(tagPairAt(text, 2, 'html')).toEqual({ open: { from: 1, to: 4 }, close: { from: 19, to: 22 } });
        expect(tagPairAt(text, 14, 'html')).toEqual({ open: { from: 6, to: 9 }, close: { from: 13, to: 16 } });
        expect(tagPairAt(text, 4, 'html')?.open).toEqual({ from: 1, to: 4 });
    });

    test('finds nothing for a tag without its other half', () => {
        expect(tagPairAt('<div><p>', 2, 'html')).toBeNull();
        expect(tagPairAt('<br>', 2, 'html')).toBeNull();
    });
});
