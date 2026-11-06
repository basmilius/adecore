import type { EditorPosition } from '@adecore/editor';
import { lspLanguageId } from '@adecore/lsp';
import type { LanguageContext } from './language-context.ts';
import type { LiveTemplate, TemplateLanguage, TemplatePlace } from './template-types.ts';

/* The completion item kind of a snippet. */
export const SNIPPET_KIND = 15;

/* Sorts a template row after the rows of the same score that a service answers. */
export function sortAfterServer(key: string): string {
    return `￿${key}`;
}

/* The families a language id counts as; TypeScript builds on JavaScript. */
export function familiesOf(languageId: string): readonly TemplateLanguage[] {
    switch (lspLanguageId(languageId)) {
        case 'javascript':
        case 'javascriptreact':
            return ['javascript'];
        case 'typescript':
        case 'typescriptreact':
            return ['javascript', 'typescript'];
        case 'php':
            return ['php'];
        case 'css':
        case 'scss':
        case 'less':
            return ['css'];
        case 'html':
        case 'xhtml':
        case 'vue':
            return ['html'];
        case 'xml':
        case 'svg':
        case 'xsl':
            return ['xml'];
        default:
            return ['other'];
    }
}

/* What a position is written in. */
export interface TemplateContext {
    readonly families: readonly TemplateLanguage[];
    readonly place: TemplatePlace;
}

/* The families and the place at a position; an editor that cannot tell has the language of the document, in code. */
export function templateContextAt(language: LanguageContext, position: EditorPosition): TemplateContext {
    const place = language.editor.placeAt?.(position);

    return place === undefined ? { families: familiesOf(language.languageId), place: 'code' } : { families: familiesOf(place.language), place: place.kind };
}

/* Whether a template shares a family with the context and applies to its place. */
export function templateApplies(template: LiveTemplate, context: TemplateContext): boolean {
    return template.languages.some((family) => context.families.includes(family)) && (template.places ?? ['code']).includes(context.place);
}
