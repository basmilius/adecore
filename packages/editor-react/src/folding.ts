import type { EditorFoldHints, EditorFoldRangeHint, EditorFoldSymbol } from '@adecore/editor';
import type { DocumentSymbolResult, FoldingRange } from '@adecore/lsp';
import type { EditorLanguage } from './editor-language.ts';
import { Refresher } from './refresher.ts';
import { symbolSpansOf } from './symbols.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/foldingRange';
const PAUSE_MS = 500;

/* The kind of body a symbol has, by LSP symbol kind; a namespace, a property of a type or an enum member has none worth folding. */
const BODIES: Readonly<Record<number, EditorFoldSymbol['body']>> = {
    5: 'class',
    6: 'method',
    7: 'value',
    8: 'value',
    9: 'method',
    10: 'class',
    11: 'class',
    12: 'function',
    13: 'value',
    14: 'value',
    23: 'class'
};

/* The symbols that have a body of more than one line, as what the editor folds them by. */
export function foldSymbolsOf(result: DocumentSymbolResult): EditorFoldSymbol[] {
    return symbolSpansOf(result).flatMap(({ kind, range }) => {
        const body = BODIES[kind];
        return body !== undefined && range.end.line > range.start.line ? [{ range, body }] : [];
    });
}

/* The ranges a server folds that span more than one line, with where a range starts and ends within its lines when it says. */
export function foldRangesOf(ranges: readonly FoldingRange[] | null): EditorFoldRangeHint[] {
    return (ranges ?? [])
        .filter((range) => range.endLine > range.startLine)
        .map((range) => ({
            startLine: range.startLine,
            endLine: range.endLine,
            ...(range.kind === undefined ? {} : { kind: range.kind }),
            ...(range.startCharacter === undefined ? {} : { startCharacter: range.startCharacter }),
            ...(range.endCharacter === undefined ? {} : { endCharacter: range.endCharacter })
        }));
}

/*
 * What the servers know about folding: the bodies of the symbols (read from the symbols the document already
 * has, so nothing is asked twice) and the ranges they fold, such as an element or a Markdown section. The
 * editor folds what the settings choose by them when the file opens, and keeps them with their text after.
 */
export class FoldingFeature {
    private symbols: EditorFoldSymbol[] = [];
    private ranges: EditorFoldRangeHint[] = [];
    private readonly refresher: Refresher;
    private readonly language: EditorLanguage;

    constructor(language: EditorLanguage, onSymbols: (listener: (result: DocumentSymbolResult) => void) => () => void, timers: Timers = realTimers) {
        this.language = language;
        const { editor, project, uri } = language;
        this.refresher = new Refresher(
            async (signal) => {
                if (!project.service.supports(METHOD, uri)) {
                    return;
                }
                const ranges = await project.service.foldingRanges(uri, { signal });
                if (!signal.aborted) {
                    this.ranges = foldRangesOf(ranges);
                    this.publish();
                }
            },
            PAUSE_MS,
            timers
        );
        const symbols = onSymbols((result) => {
            this.symbols = foldSymbolsOf(result);
            this.publish();
        });
        const edits = editor.onTextChange(() => this.refresher.later());
        const providers = language.onProvidersChanged(() => {
            this.refresher.now();
        });
        language.onDispose(() => {
            symbols();
            edits();
            providers();
            this.refresher.dispose();
            editor.setFoldHints(null);
        });
    }

    private publish(): void {
        const hints: EditorFoldHints = { symbols: this.symbols, ranges: this.ranges };
        this.language.editor.setFoldHints(hints);
    }
}
