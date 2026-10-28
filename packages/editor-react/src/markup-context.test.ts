import { describe, expect, test } from 'bun:test';
import { enclosingElements, markupPlaceAt, markupSyntaxOf, removeTagEdits, tagPairAt, type MarkupSyntax } from './markup-context.ts';

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

describe('enclosingElements', () => {
    test('lists the elements around an offset with their tags, innermost first', () => {
        const text = '<div><ul><li>a</li></ul></div>';
        const found = enclosingElements(text, 14, 'html');

        expect(found.map((element) => element.name)).toEqual(['li', 'ul', 'div']);
        expect(found[0]).toEqual({ name: 'li', open: { from: 9, to: 13 }, close: { from: 14, to: 19 } });
    });

    test('leaves out void elements and elements that closed before the offset', () => {
        expect(enclosingElements('<p><br><b>x</b> y</p>', 17, 'html').map((element) => element.name)).toEqual(['p']);
    });

    test('has no end tag for an element that is left open, and reads raw elements', () => {
        expect(enclosingElements('<div><p>a', 8, 'html')).toEqual([
            { name: 'p', open: { from: 5, to: 8 }, close: null },
            { name: 'div', open: { from: 0, to: 5 }, close: null }
        ]);
        expect(enclosingElements('<script>if (a < b) {}</script>', 12, 'html').map((element) => element.name)).toEqual(['script']);
    });
});

describe('removeTagEdits', () => {
    function removed(text: string, name: string, unit = '    '): string {
        const offset = text.indexOf('|');
        const source = text.replace('|', '');
        const element = enclosingElements(source, offset, 'html').find((candidate) => candidate.name === name)!;

        return removeTagEdits(source, element, unit)
            .reverse()
            .reduce((result, edit) => result.slice(0, edit.from) + edit.text + result.slice(edit.to), source);
    }

    test('takes tags that share a line with text and leaves the line', () => {
        expect(removed('<p>a <b>|c</b> d</p>', 'b')).toBe('<p>a c d</p>');
    });

    test('takes the lines of tags that stand alone and moves the lines between them one unit out', () => {
        expect(removed('<div>\n    <ul>\n        <li>|a</li>\n    </ul>\n</div>', 'ul')).toBe('<div>\n    <li>a</li>\n</div>');
    });

    test('takes the line of a last tag that has no line break after it', () => {
        expect(removed('<ul>\n    <li>|a</li>\n</ul>', 'ul')).toBe('<li>a</li>');
    });

    test('moves out one tab of a tab-indented element', () => {
        expect(removed('<div>\n\t<p>|a</p>\n</div>', 'div', '\t')).toBe('<p>a</p>');
    });
});
