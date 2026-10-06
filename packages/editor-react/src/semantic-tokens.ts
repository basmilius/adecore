import type { EditorLanguage } from './editor-language.ts';
import { Refresher } from './refresher.ts';
import { decodeSemanticTokens } from './semantic-model.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/semanticTokens/full';
const PAUSE_MS = 200;

/*
 * Colors the editor draws from what the language servers know, over what the grammar made of the text:
 * a class is a class and a call is a call where the grammar could only guess. It asks after a pause in
 * typing and when a server says its offer changed, and keeps drawing the last answer, which follows its
 * text through edits, in between, so the colors never blink out while the next one is on its way.
 */
export class SemanticTokensFeature {
    private readonly refresher: Refresher;

    constructor(language: EditorLanguage, timers: Timers = realTimers) {
        const { editor, project, uri } = language;
        this.refresher = new Refresher(
            async (signal) => {
                const { service } = project;
                const legend = service.providerOptions(METHOD, uri)?.legend;
                if (!service.supports(METHOD, uri) || legend === undefined) {
                    return;
                }
                const tokens = await service.semanticTokens(uri, { signal });
                if (!signal.aborted) {
                    editor.setSemanticTokens(tokens === null ? null : decodeSemanticTokens(tokens, legend));
                }
            },
            PAUSE_MS,
            timers
        );
        const edits = editor.onTextChange(() => this.refresher.later());
        const providers = language.onProvidersChanged(() => {
            this.refresher.now();
        });
        language.onDispose(() => {
            edits();
            providers();
            this.refresher.dispose();
            editor.setSemanticTokens(null);
        });
    }
}
