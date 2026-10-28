import type { EditSource } from './edit-source.ts';
import { editRegions } from './edit-regions.ts';
import { vueRegionAt } from './languages.ts';
import type { TypingContext } from './typing-context.ts';

export type TextPlaceKind = 'code' | 'comment' | 'string';

export interface TextPlace {
    /* The language the offset is written in, with embedded regions resolved: `typescript` in `<script lang="ts">` of a Vue file, `css` in `<style>`, `html` in PHP markup. */
    readonly language: string;
    readonly kind: TextPlaceKind;
}

const SCAN_LIMIT = 2_000_000;
const JSX_LANGUAGES = /^(?:typescriptreact|javascriptreact|tsx|jsx)$/;
const VUE_TAG = /^<\/?(?:template|script|style)\b/;

function kindOf(context: TypingContext): TextPlaceKind {
    switch (context.mode) {
        case 'line-comment':
        case 'block-comment':
        case 'html-comment':
            return 'comment';

        case 'quote':
        case 'template':
        case 'heredoc':
        case 'regex':
            return 'string';

        case 'html':
            if (context.markup === 'comment') {
                return 'comment';
            }

            return context.markup === 'value' ? 'string' : 'code';

        default:
            return 'code';
    }
}

/* The language of a `<script>` or `<style>` of a Vue file, read from the `lang` attribute of the tag that opened the region. */
function vueRegionLanguage(source: EditSource, line: number, region: 'script' | 'style'): string {
    for (let index = line; index >= 0; index--) {
        const text = source.line(index).text;

        if (!text.startsWith(`<${region}`)) {
            continue;
        }

        const lang = /\blang\s*=\s*["']?([\w-]+)/.exec(text)?.[1]?.toLowerCase();

        if (region === 'style') {
            return lang === 'scss' || lang === 'less' ? lang : 'css';
        }

        return lang === 'ts' || lang === 'tsx' ? 'typescript' : 'javascript';
    }

    return region === 'style' ? 'css' : 'javascript';
}

function vueLanguage(source: EditSource, offset: number): string {
    const line = source.lineAt(offset);
    const region = VUE_TAG.test(source.line(line).text) ? null : vueRegionAt((index) => source.line(index).text, line);

    return region === 'script' || region === 'style' ? vueRegionLanguage(source, line, region) : 'html';
}

/* Whether a `<script>` or `<style>` element is open at the offset in a plain markup document. */
function markupLanguage(source: EditSource, offset: number): string {
    let open: string | null = null;

    for (const match of source.slice(0, offset).matchAll(/<(\/)?(script|style)\b[^>]*?(\/)?>/gi)) {
        open = match[1] === undefined && match[3] === undefined ? match[2]!.toLowerCase() : null;
    }

    if (open === null) {
        return 'html';
    }

    return open === 'script' ? 'javascript' : 'css';
}

function phpLanguage(context: TypingContext): string {
    if (context.embedded === 'javascript') {
        return 'javascript';
    }

    if (context.mode !== 'html') {
        return 'php';
    }

    return context.markup === 'raw' && context.element === 'style' ? 'css' : 'html';
}

/* What the text at an offset is written in and whether it is code, a comment or a string. */
export function placeAt(source: EditSource, offset: number, language: string): TextPlace {
    const id = language.toLowerCase();

    if (source.line(source.lineCount - 1).end > SCAN_LIMIT) {
        return { language, kind: 'code' };
    }

    const context = source.context(offset);
    const kind = kindOf(context);

    if (id === 'php') {
        return { language: phpLanguage(context), kind };
    }

    if (id === 'vue') {
        return { language: vueLanguage(source, offset), kind };
    }

    if (id === 'html' || id === 'xhtml') {
        return { language: markupLanguage(source, offset), kind };
    }

    if (JSX_LANGUAGES.test(id) && editRegions(source, id)(source.lineAt(offset), offset) === 'jsx') {
        return { language: 'html', kind };
    }

    return { language, kind };
}
