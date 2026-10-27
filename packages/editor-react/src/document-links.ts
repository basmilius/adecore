import type { EditorPosition, EditorRange } from '@adecore/editor';
import type { DocumentLink } from '@adecore/lsp';
import { comparePositions } from './diagnostics-model.ts';
import { DocumentQuery } from './document-query.ts';
import type { EditorLanguage } from './editor-language.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/documentLink';
const RESOLVE = 'documentLink/resolve';
/* How long after the last edit the links are asked again. */
const DELAY_MS = 500;
/* `#L12`, `#12` or `#L12,4`: a line, from one, and a column, from one, the form editors write into a link. */
const LINE_FRAGMENT = /^#L?(\d+)(?:[,:C](\d+))?$/i;

/* Where a link to a file of the editor lands, from the line its fragment names; the start of the file without one. */
export function linkPosition(target: string): { readonly uri: string; readonly position: EditorPosition } {
    const hash = target.indexOf('#');
    const fragment = hash === -1 ? null : LINE_FRAGMENT.exec(target.slice(hash));
    if (fragment === null) {
        return { uri: target, position: { line: 0, character: 0 } };
    }
    return {
        uri: target.slice(0, hash),
        position: { line: Math.max(0, Number(fragment[1]) - 1), character: Math.max(0, Number(fragment[2] ?? 1) - 1) }
    };
}

/* Whether a target opens in the editor: a file, or a document of a scheme a server serves. A web address opens outside. */
function opensInEditor(target: string): boolean {
    return !/^(https?|mailto|ftp):/i.test(target);
}

/*
 * The links a server finds in the text, such as an import path or a web address in a comment. Mod+click on one
 * follows it, and while Mod is held the link under the pointer is drawn as one (`DefinitionLinkFeature` draws it).
 * A link without a target asks the server for it first.
 */
export class DocumentLinksFeature {
    private readonly language: EditorLanguage;
    private links: readonly DocumentLink[] = [];
    private readonly query: DocumentQuery<DocumentLink[]>;

    constructor(language: EditorLanguage, timers: Timers = realTimers) {
        this.language = language;
        this.query = new DocumentQuery(
            language,
            timers,
            DELAY_MS,
            (signal) => (this.supported ? language.service.documentLinks!(language.uri, { signal }) : Promise.resolve(null)),
            (links) => {
                this.links = links ?? [];
            }
        );
        const off = language.editor.onClick((click) => {
            if (!click.mod || click.alt || click.shift) {
                return false;
            }
            const link = this.linkAt(click.position);
            if (link === null) {
                return false;
            }
            void this.follow(link);
            return true;
        });
        language.onDispose(off);
    }

    get supported(): boolean {
        const { service } = this.language;
        return service.documentLinks !== undefined && service.supports(METHOD, this.language.uri);
    }

    /* The links of the current text, empty while an edit waits for the next answer. */
    all(): readonly DocumentLink[] {
        return this.links;
    }

    /* The link whose range holds `position`, its end left out. */
    linkAt(position: EditorPosition): DocumentLink | null {
        return this.links.find((link) => comparePositions(link.range.start, position) <= 0 && comparePositions(position, link.range.end) < 0) ?? null;
    }

    /* The range of the link at `position`, which the pointer draws as a link while Mod is held. */
    rangeAt(position: EditorPosition): EditorRange | null {
        return this.linkAt(position)?.range ?? null;
    }

    refresh(): void {
        this.query.run();
    }

    /* Opens what a link points at; false when it has no target, even after asking. */
    async follow(link: DocumentLink): Promise<boolean> {
        const target = link.target ?? (await this.resolve(link))?.target;
        if (target === undefined) {
            return false;
        }
        openTarget(this.language, target);
        return true;
    }

    private async resolve(link: DocumentLink): Promise<DocumentLink | null> {
        const { service } = this.language;
        if (service.resolveDocumentLink === undefined || service.providerOptions(RESOLVE, this.language.uri)?.resolveProvider !== true) {
            return null;
        }
        try {
            return await service.resolveDocumentLink(this.language.uri, link);
        } catch {
            return null;
        }
    }
}

/* Opens a file or a document of a server in the editor, and a web address through the host. */
export function openTarget(language: EditorLanguage, target: string, selection?: EditorRange): void {
    if (!opensInEditor(target)) {
        const { host } = language.project;
        if (host.openExternal !== undefined) {
            host.openExternal(target);
        } else if (typeof window !== 'undefined') {
            window.open(target, '_blank', 'noopener,noreferrer');
        }
        return;
    }
    const { uri, position } = linkPosition(target);
    const range = selection ?? { start: position, end: position };
    language.goTo({ uri, range });
}
