// A reference and no import, so an app that type-checks this source reads the declaration of the package too.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./emmet-module.d.ts" />
import { extract, markup, markupAbbreviation, resolveConfig, type MarkupAbbreviationNode } from 'emmet';
import type { MarkupSyntax } from './markup-context.ts';

export interface AbbreviationOptions {
    readonly syntax: MarkupSyntax;
    /* One level of indentation inside the expansion. */
    readonly indent: string;
    /* Lines the abbreviation wraps; a repeated element without a count takes one line each. */
    readonly wrap?: readonly string[];
}

export interface FoundAbbreviation {
    readonly abbreviation: string;
    /* UTF-16 columns of the line, `end` past the caret when brackets the editor closed follow it. */
    readonly start: number;
    readonly end: number;
}

/* A text of an expansion is snippet syntax, where these mean a tab stop or end one. */
function escapeText(text: string): string {
    return text.replace(/[$}\\]/g, '\\$&');
}

function field(index: number, placeholder: string): string {
    return placeholder === '' ? `\${${index}}` : `\${${index}:${escapeText(placeholder)}}`;
}

/* `lipsum` is the other name of `lorem` that IntelliJ and the Emmet documentation accept. */
function renameLipsum(node: MarkupAbbreviationNode): void {
    if (node.name !== undefined && /^lipsum(?=\d|$)/i.test(node.name)) {
        node.name = 'lorem' + node.name.slice(6);
    }
    for (const child of node.children) {
        renameLipsum(child);
    }
}

/* The abbreviation that ends at `character` of a line, or null where nothing before the caret reads as one. */
export function abbreviationBefore(line: string, character: number): FoundAbbreviation | null {
    const found = extract(line, character, { type: 'markup', lookAhead: true });
    if (found === undefined || !/^[A-Za-z!.#([{]/.test(found.abbreviation)) {
        return null;
    }
    return { abbreviation: found.abbreviation, start: found.start, end: found.end };
}

/*
 * The expansion of an abbreviation as snippet text, its places to fill as tab stops; null when it does not
 * read as one. Lorem ipsum words after the first sentence differ per expansion.
 */
export function expandAbbreviation(abbreviation: string, options: AbbreviationOptions): string | null {
    const text = options.wrap === undefined ? undefined : [...options.wrap];
    try {
        const tree = markupAbbreviation(abbreviation, { text });
        for (const child of tree.children) {
            renameLipsum(child);
        }
        const expanded = markup(
            tree,
            resolveConfig({
                syntax: options.syntax === 'xml' ? 'xml' : 'html',
                text,
                options: { 'output.field': field, 'output.text': escapeText, 'output.indent': options.indent }
            })
        );
        return expanded === '' ? null : expanded;
    } catch {
        return null;
    }
}
