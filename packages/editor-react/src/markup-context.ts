/* `vue` and `php` are HTML with interpolations or code blocks a markup feature leaves alone. */
export type MarkupSyntax = 'html' | 'xml' | 'vue' | 'php';

export interface OpenElement {
    readonly name: string;
    /* The offset of the first character of the name, after the `<`. */
    readonly nameFrom: number;
}

/* The tag an offset is in, from its `<` up to and including its `>`. */
export interface TagAt {
    readonly start: number;
    readonly closing: boolean;
    readonly name: string;
    readonly nameFrom: number;
    readonly nameTo: number;
    /* The offset is inside a quoted attribute value. */
    readonly inValue: boolean;
}

export type MarkupPlace =
    | { readonly kind: 'text'; readonly open: readonly OpenElement[] }
    | { readonly kind: 'tag'; readonly tag: TagAt }
    | { readonly kind: 'other' };

/* The names of an element that are one start tag and its end tag, which change together. */
export interface TagPair {
    readonly open: { readonly from: number; readonly to: number };
    readonly close: { readonly from: number; readonly to: number };
}

/* A whole tag, from its `<` up to and after its `>`. */
export interface TagSpan {
    readonly from: number;
    readonly to: number;
}

/* An element as its tags: `close` is null for one that was never closed. */
export interface EnclosingElement {
    readonly name: string;
    readonly open: TagSpan;
    readonly close: TagSpan | null;
}

/* Above this a document is not read on a keystroke; the features then do nothing in it. */
export const MAX_MARKUP_SCAN = 1_000_000;

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);
const NAME_START = /[A-Za-z]/;
const NAME = /[\w:.-]/;

export function markupSyntaxOf(languageId: string): MarkupSyntax | null {
    switch (languageId.toLowerCase()) {
        case 'html':
        case 'xhtml':
            return 'html';
        case 'xml':
        case 'svg':
        case 'xsl':
            return 'xml';
        case 'vue':
            return 'vue';
        case 'php':
            return 'php';
        default:
            return null;
    }
}

/* Whether an element of this name has no end tag, which only HTML has. */
export function isVoidElement(name: string, syntax: MarkupSyntax): boolean {
    return syntax !== 'xml' && VOID_ELEMENTS.has(name.toLowerCase());
}

class Stop {
    readonly place: MarkupPlace;

    constructor(place: MarkupPlace) {
        this.place = place;
    }
}

/*
 * A reader of markup that is no parser: it follows tags, comments, raw elements and the code blocks of
 * PHP and Vue far enough to tell what an offset is in, and pairs a start tag with the end tag that closes it.
 */
class MarkupScanner {
    readonly pairs: TagPair[] = [];
    readonly elements: EnclosingElement[] = [];
    private readonly text: string;
    private readonly syntax: MarkupSyntax;
    private readonly until: number;
    private readonly open: (OpenElement & { readonly nameTo: number; readonly tag: TagSpan })[] = [];

    constructor(text: string, syntax: MarkupSyntax, until: number) {
        this.text = text;
        this.syntax = syntax;
        this.until = until;
    }

    run(): MarkupPlace {
        try {
            this.content();
            return this.textPlace();
        } catch (error) {
            if (error instanceof Stop) {
                return error.place;
            }
            throw error;
        }
    }

    private textPlace(): MarkupPlace {
        return { kind: 'text', open: this.open.map(({ name, nameFrom }) => ({ name, nameFrom })) };
    }

    /* Leaves the scan with what the offset is in when it lies in `from` to `to`, `to` included where the construct owns its last character. */
    private reached(from: number, to: number, place: () => MarkupPlace): void {
        if (from < this.until && this.until <= to) {
            throw new Stop(place());
        }
    }

    private content(): void {
        const { text } = this;
        let at = 0;
        while (at < text.length) {
            if (at >= this.until) {
                throw new Stop(this.textPlace());
            }
            const char = text[at]!;
            if (char === '<') {
                at = this.markup(at);
            } else if (this.syntax === 'vue' && char === '{' && text[at + 1] === '{') {
                at = this.skipTo(at, '}}');
            } else {
                at++;
            }
        }
    }

    /* Skips from `from` past `close`, the whole construct counting as something other than text. */
    private skipTo(from: number, close: string): number {
        const end = this.text.indexOf(close, from + 1);
        const after = end === -1 ? this.text.length : end + close.length;
        this.reached(from, end === -1 ? after : after - 1, () => ({ kind: 'other' }));
        return after;
    }

    private markup(at: number): number {
        const { text } = this;
        if (text.startsWith('<!--', at)) {
            return this.skipTo(at, '-->');
        }
        if (text.startsWith('<![CDATA[', at)) {
            return this.skipTo(at, ']]>');
        }
        if (text[at + 1] === '?') {
            return this.skipTo(at, this.syntax === 'php' ? '?>' : '>');
        }
        if (text[at + 1] === '!') {
            return this.skipTo(at, '>');
        }
        const closing = text[at + 1] === '/';
        const nameFrom = at + (closing ? 2 : 1);
        if (!NAME_START.test(text[nameFrom] ?? '')) {
            return at + 1;
        }
        let nameTo = nameFrom;
        while (nameTo < text.length && NAME.test(text[nameTo]!)) {
            nameTo++;
        }
        const name = text.slice(nameFrom, nameTo);
        const end = this.tagEnd(at, closing, name, nameFrom, nameTo);
        if (closing) {
            this.close(name, nameFrom, nameTo, { from: at, to: end });
            return end;
        }
        const selfClosing = text[end - 2] === '/' && text[end - 1] === '>';
        if (selfClosing || isVoidElement(name, this.syntax)) {
            return end;
        }
        if (this.syntax !== 'xml' && RAW_ELEMENTS.has(name.toLowerCase())) {
            return this.rawContent({ from: at, to: end }, name, nameFrom, nameTo);
        }
        this.open.push({ name, nameFrom, nameTo, tag: { from: at, to: end } });
        return end;
    }

    /* Reads the attributes of a tag up to the offset after its `>`, quotes and PHP blocks included. */
    private tagEnd(start: number, closing: boolean, name: string, nameFrom: number, nameTo: number): number {
        const { text } = this;
        let at = nameTo;
        let quote: string | null = null;
        let valueFrom = -1;
        while (at < text.length) {
            const char = text[at]!;
            if (this.syntax === 'php' && char === '<' && text[at + 1] === '?') {
                at = this.skipTo(at, '?>');
                continue;
            }
            if (quote !== null) {
                if (char === quote) {
                    this.reached(valueFrom, at, () => ({ kind: 'tag', tag: { start, closing, name, nameFrom, nameTo, inValue: true } }));
                    quote = null;
                }
            } else if (char === '"' || char === "'") {
                quote = char;
                valueFrom = at;
            } else if (char === '>') {
                this.reached(start, at, () => ({ kind: 'tag', tag: { start, closing, name, nameFrom, nameTo, inValue: false } }));
                return at + 1;
            } else if (char === '<') {
                // A tag that never closed ends where the next one starts.
                this.reached(start, at, () => ({ kind: 'tag', tag: { start, closing, name, nameFrom, nameTo, inValue: false } }));
                return at;
            }
            at++;
        }
        this.reached(start, text.length, () => ({
            kind: 'tag',
            tag: { start, closing, name, nameFrom, nameTo, inValue: quote !== null && this.until > valueFrom }
        }));
        return text.length;
    }

    /* The content of `script`, `style` and the like is not markup, up to the end tag of the element. */
    private rawContent(tag: TagSpan, name: string, nameFrom: number, nameTo: number): number {
        const from = tag.to;
        const pattern = new RegExp(`</${name}(?=[\\s/>]|$)`, 'gi');
        pattern.lastIndex = from;
        const match = pattern.exec(this.text);
        const end = match === null ? this.text.length : match.index;
        this.reached(from - 1, end, () => ({ kind: 'other' }));
        if (match === null) {
            return end;
        }
        const closeFrom = end + 2;
        const closeTo = closeFrom + name.length;
        const after = this.tagEnd(end, true, this.text.slice(closeFrom, closeTo), closeFrom, closeTo);
        this.pairs.push({ open: { from: nameFrom, to: nameTo }, close: { from: closeFrom, to: closeTo } });
        this.elements.push({ name, open: tag, close: { from: end, to: after } });
        return after;
    }

    /* An end tag closes the nearest open element of its name and every element left open inside it. */
    private close(name: string, nameFrom: number, nameTo: number, tag: TagSpan): void {
        const caseless = this.syntax !== 'xml';
        for (let index = this.open.length - 1; index >= 0; index--) {
            const element = this.open[index]!;
            if (element.name === name || (caseless && element.name.toLowerCase() === name.toLowerCase())) {
                this.pairs.push({ open: { from: element.nameFrom, to: element.nameTo }, close: { from: nameFrom, to: nameTo } });
                this.elements.push({ name: element.name, open: element.tag, close: tag });
                this.open.length = index;
                return;
            }
        }
    }

    /* The elements still open at the end of the text. */
    unclosed(): EnclosingElement[] {
        return this.open.map((element) => ({ name: element.name, open: element.tag, close: null }));
    }
}

/*
 * The elements whose tags hold `offset`, innermost first: each with its start tag and its end tag, which an element left
 * open does not have. Empty for a document too large to read on a keystroke.
 */
export function enclosingElements(text: string, offset: number, syntax: MarkupSyntax): EnclosingElement[] {
    if (text.length > MAX_MARKUP_SCAN) {
        return [];
    }
    const scanner = new MarkupScanner(text, syntax, Infinity);
    scanner.run();
    return [...scanner.elements, ...scanner.unclosed()]
        .filter((element) => element.open.from <= offset && offset <= (element.close?.to ?? text.length))
        .sort((left, right) => right.open.from - left.open.from);
}

/* A replacement of the text from one offset up to another. */
export interface TextReplacement {
    readonly from: number;
    readonly to: number;
    readonly text: string;
}

export function lineStartOf(text: string, offset: number): number {
    let at = offset;

    while (at > 0 && text[at - 1] !== '\n' && text[at - 1] !== '\r') {
        at--;
    }

    return at;
}

export function lineEndOf(text: string, offset: number): number {
    let at = offset;

    while (at < text.length && text[at] !== '\n' && text[at] !== '\r') {
        at++;
    }

    return at;
}

function breakLengthAt(text: string, offset: number): number {
    if (text.startsWith('\r\n', offset)) {
        return 2;
    }

    return text[offset] === '\n' || text[offset] === '\r' ? 1 : 0;
}

/* The tag alone on its line takes the line with it, and the break before it where no break follows. */
function tagReplacement(text: string, tag: TagSpan): TextReplacement {
    const start = lineStartOf(text, tag.from);
    const end = lineEndOf(text, tag.to);

    if (text.slice(start, tag.from).trim() !== '' || text.slice(tag.to, end).trim() !== '') {
        return { from: tag.from, to: tag.to, text: '' };
    }

    const after = breakLengthAt(text, end);
    const before = start > 0 && after === 0 ? (text.startsWith('\r\n', start - 2) ? 2 : 1) : 0;

    return { from: start - before, to: end + after, text: '' };
}

/*
 * The edits that take an element's tags away and keep what is between them: each tag that stands alone on its line
 * goes with its line, and when the start tag does, the lines it enclosed lose one indentation unit. The offsets are
 * those of `text`, ascending and apart.
 */
export function removeTagEdits(text: string, element: EnclosingElement, unit: string): TextReplacement[] {
    const open = tagReplacement(text, element.open);
    const edits: TextReplacement[] = [open];

    if (element.close === null) {
        return edits;
    }

    const close = tagReplacement(text, element.close);
    const openAlone = open.from !== element.open.from || open.to !== element.open.to;
    const closeAlone = close.from !== element.close.from || close.to !== element.close.to;
    const indent = unit === '\t' ? /^\t/ : new RegExp(`^ {1,${unit.length}}`);
    const lastLine = lineStartOf(text, element.close.from);
    let line = lineEndOf(text, element.open.to);

    line += breakLengthAt(text, line);

    while (openAlone && line <= lastLine && line < text.length && !(closeAlone && line === lastLine)) {
        const found = indent.exec(text.slice(line, lineEndOf(text, line)));

        if (found !== null) {
            edits.push({ from: line, to: line + found[0].length, text: '' });
        }

        line = lineEndOf(text, line);
        line += breakLengthAt(text, line);
    }

    edits.push(close);

    return edits;
}

/* What `offset` is in; null for a document too large to read on a keystroke. */
export function markupPlaceAt(text: string, offset: number, syntax: MarkupSyntax): MarkupPlace | null {
    if (text.length > MAX_MARKUP_SCAN) {
        return null;
    }
    return new MarkupScanner(text, syntax, offset).run();
}

/* The start and end tag names of the element whose name holds `offset`, either one, its edges included. */
export function tagPairAt(text: string, offset: number, syntax: MarkupSyntax): TagPair | null {
    if (text.length > MAX_MARKUP_SCAN) {
        return null;
    }
    const scanner = new MarkupScanner(text, syntax, Infinity);
    scanner.run();
    const holds = (range: { from: number; to: number }): boolean => range.from <= offset && offset <= range.to;
    return scanner.pairs.find((pair) => holds(pair.open) || holds(pair.close)) ?? null;
}
