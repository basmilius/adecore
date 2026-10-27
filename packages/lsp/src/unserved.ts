import { ErrorCodes, LspError } from './connection.ts';
import type { Disposable } from './protocol.ts';
import type { LanguageService } from './service.ts';

const REQUESTS = [
    'completion',
    'resolveCompletion',
    'hover',
    'signatureHelp',
    'definition',
    'declaration',
    'typeDefinition',
    'implementation',
    'references',
    'documentHighlights',
    'documentSymbols',
    'prepareRename',
    'rename',
    'codeActions',
    'resolveCodeAction',
    'executeCommand',
    'formatting',
    'rangeFormatting',
    'semanticTokens',
    'semanticTokensDelta',
    'semanticTokensRange',
    'inlayHints',
    'resolveInlayHint',
    'workspaceSymbols',
    'foldingRanges',
    'selectionRanges',
    'codeLenses',
    'resolveCodeLens'
] as const satisfies readonly (keyof LanguageService)[];

const NOTHING: Disposable = { dispose: () => undefined };

function refuse(): Promise<never> {
    return Promise.reject(new LspError('No language server serves this document', ErrorCodes.MethodNotFound));
}

/*
 * A service for documents no server serves: it takes documents and answers `supports` with false, so a
 * feature that checks first never asks, and rejects every request with an `LspError` of code -32601.
 */
export function unservedLanguageService(): LanguageService {
    // Every request has the same refusal whatever its parameters, which the record type cannot say.
    const requests = Object.fromEntries(REQUESTS.map((name) => [name, refuse])) as unknown as Pick<LanguageService, (typeof REQUESTS)[number]>;

    return {
        ...requests,
        openDocument: () => Promise.resolve(),
        changeDocument: () => Promise.resolve(),
        closeDocument: () => Promise.resolve(),
        supports: () => false,
        providerOptions: () => undefined,
        onProvidersChanged: () => NOTHING,
        onDiagnostics: () => NOTHING
    };
}
