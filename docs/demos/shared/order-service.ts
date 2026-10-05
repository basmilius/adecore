import type { CompletionItem, Diagnostic, DocumentSymbol, Location, Position, Range, TextEdit } from '@adecore/lsp';
import type { FakeLanguageService, LanguageCall } from '@adecore/editor-react/testing';
import { DEMO_URI, FORMAT_SOURCE } from './editor.ts';

/*
 * What a TypeScript server would answer about the demo file, worked out from its text with a few regular
 * expressions. Each `respond*` registers one feature, so a demo turns on only what it shows.
 */

const FORMAT_URI = 'file:///shop/src/format.ts';

const textOf = (service: FakeLanguageService, uri: string): string => (uri === FORMAT_URI ? FORMAT_SOURCE : (service.documents.get(uri)?.text ?? ''));

const range = (line: number, from: number, to: number): Range => ({ start: { line, character: from }, end: { line, character: to } });

/* The word under a position, with where it starts and ends on its line. */
function wordAt(text: string, position: Position): { word: string; from: number; to: number } | null {
    const line = text.split('\n')[position.line] ?? '';
    for (const match of line.matchAll(/[A-Za-z_$][\w$]*/g)) {
        if (match.index <= position.character && position.character <= match.index + match[0].length) {
            return { word: match[0], from: match.index, to: match.index + match[0].length };
        }
    }
    return null;
}

/* Every whole-word use of `word` in a text, optionally only between two lines. */
function usesOf(text: string, word: string, uri: string, first = 0, last = Number.MAX_SAFE_INTEGER): Location[] {
    return text
        .split('\n')
        .flatMap((line, index) =>
            index < first || index > last
                ? []
                : [...line.matchAll(new RegExp(`\\b${word}\\b`, 'g'))].map((match) => ({ uri, range: range(index, match.index, match.index + word.length) }))
        );
}

/* The functions of the file, from `export function name(` to the `}` that closes it at the start of a line. */
function functionsOf(text: string): DocumentSymbol[] {
    const lines = text.split('\n');
    return lines.flatMap((line, index) => {
        const match = /^export function (\w+)/.exec(line);
        if (match === null) {
            return [];
        }
        const end = lines.findIndex((other, at) => at > index && other.startsWith('}'));
        const last = end < 0 ? lines.length - 1 : end;
        return [
            {
                name: match[1]!,
                kind: 12,
                range: { start: { line: index, character: 0 }, end: { line: last, character: lines[last]!.length } },
                selectionRange: range(index, 16, 16 + match[1]!.length)
            }
        ];
    });
}

/* The function a line is in, so a local name is renamed and lit only there. */
function scopeOf(text: string, line: number): { first: number; last: number } {
    const symbol = functionsOf(text).find((candidate) => candidate.range.start.line <= line && line <= candidate.range.end.line);
    return symbol === undefined ? { first: 0, last: Number.MAX_SAFE_INTEGER } : { first: symbol.range.start.line, last: symbol.range.end.line };
}

const position = (call: LanguageCall): Position => (call.params as { position: Position }).position;

const DOCS: Record<string, string> = {
    orderTotal: '```ts\nfunction orderTotal(lines: OrderLine[]): number\n```\nThe total of every line of an order.',
    describeOrder: '```ts\nfunction describeOrder(lines: OrderLine[]): string\n```',
    formatNumber:
        '```ts\nfunction formatNumber(value: number): string\n```\nWrites a number the way the `en` locale does.\n\n@param value The number to write.',
    total: '```ts\nlet total: number\n```',
    lines: '```ts\n(parameter) lines: OrderLine[]\n```'
};

export function respondHover(service: FakeLanguageService): void {
    service.respond('textDocument/hover', (call) => {
        const found = wordAt(textOf(service, call.uri), position(call));
        const value = found === null ? undefined : DOCS[found.word];
        return value === undefined ? null : { contents: { kind: 'markdown', value }, range: range(position(call).line, found!.from, found!.to) };
    });
}

const MEMBERS: CompletionItem[] = [
    { label: 'price', kind: 10, detail: 'number' },
    { label: 'quantity', kind: 10, detail: 'number' },
    { label: 'product', kind: 10, detail: 'string' }
];

const NAMES: CompletionItem[] = [
    { label: 'orderTotal', kind: 3, detail: '(lines: OrderLine[]) => number' },
    { label: 'describeOrder', kind: 3, detail: '(lines: OrderLine[]) => string' },
    { label: 'formatNumber', kind: 3, detail: '(value: number) => string' },
    { label: 'lines', kind: 6, detail: 'OrderLine[]' },
    { label: 'total', kind: 6, detail: 'number' },
    { label: 'forof', kind: 15, insertText: 'for (const ${1:item} of ${2:items}) {\n\t$0\n}', insertTextFormat: 2, detail: 'for...of loop' }
];

export function respondCompletion(service: FakeLanguageService): void {
    service.respond(
        'textDocument/completion',
        (call) => {
            const at = position(call);
            const line = textOf(service, call.uri).split('\n')[at.line] ?? '';
            return /\.[\w$]*$/.test(line.slice(0, at.character)) ? MEMBERS : NAMES;
        },
        { triggerCharacters: ['.'] }
    );
}

const SIGNATURES: Record<string, { label: string; parameters: string[]; documentation: string }> = {
    orderTotal: { label: 'orderTotal(lines: OrderLine[]): number', parameters: ['lines: OrderLine[]'], documentation: 'The total of every line of an order.' },
    formatNumber: {
        label: 'formatNumber(value: number): string',
        parameters: ['value: number'],
        documentation: 'Writes a number the way the `en` locale does.'
    }
};

export function respondSignatureHelp(service: FakeLanguageService): void {
    service.respond(
        'textDocument/signatureHelp',
        (call) => {
            const at = position(call);
            const before = (textOf(service, call.uri).split('\n')[at.line] ?? '').slice(0, at.character);
            const open = /(\w+)\(([^()]*)$/.exec(before);
            const signature = open === null ? undefined : SIGNATURES[open[1]!];
            if (signature === undefined) {
                return null;
            }
            return {
                signatures: [{ label: signature.label, documentation: signature.documentation, parameters: signature.parameters.map((label) => ({ label })) }],
                activeSignature: 0,
                activeParameter: open![2]!.split(',').length - 1
            };
        },
        { triggerCharacters: ['(', ','] }
    );
}

export function respondNavigation(service: FakeLanguageService): void {
    service.respond('textDocument/definition', (call) => {
        const found = wordAt(textOf(service, call.uri), position(call));
        if (found?.word === 'formatNumber') {
            return [
                { uri: DEMO_URI, range: range(0, 9, 21) },
                { uri: FORMAT_URI, range: range(0, 16, 28) }
            ];
        }
        const symbol = functionsOf(textOf(service, call.uri)).find((candidate) => candidate.name === found?.word);
        return symbol === undefined ? null : { uri: call.uri, range: symbol.selectionRange };
    });
    service.respond('textDocument/references', (call) => {
        const text = textOf(service, call.uri);
        const found = wordAt(text, position(call));
        if (found === null) {
            return null;
        }
        const scope = DOCS[found.word]?.includes('function') === true ? { first: 0, last: Number.MAX_SAFE_INTEGER } : scopeOf(text, position(call).line);
        const all = usesOf(text, found.word, call.uri, scope.first, scope.last);
        const uses = found.word === 'formatNumber' ? [...all, ...usesOf(FORMAT_SOURCE, found.word, FORMAT_URI)] : all;
        const { context } = call.params as { context: { includeDeclaration?: boolean } };
        const declaration = functionsOf(text).find((symbol) => symbol.name === found.word)?.selectionRange.start;
        return context.includeDeclaration === false && declaration !== undefined
            ? uses.filter((use) => use.uri !== call.uri || use.range.start.line !== declaration.line || use.range.start.character !== declaration.character)
            : uses;
    });
}

export function respondSymbols(service: FakeLanguageService): void {
    service.respond('textDocument/documentSymbol', (call) => functionsOf(textOf(service, call.uri)));
}

export function respondHighlights(service: FakeLanguageService): void {
    service.respond('textDocument/documentHighlight', (call) => {
        const text = textOf(service, call.uri);
        const found = wordAt(text, position(call));
        if (found === null) {
            return null;
        }
        const scope = scopeOf(text, position(call).line);
        return usesOf(text, found.word, call.uri, scope.first, scope.last).map((use) => ({ range: use.range }));
    });
}

export function respondRename(service: FakeLanguageService): void {
    service.respond('textDocument/prepareRename', (call) => {
        const found = wordAt(textOf(service, call.uri), position(call));
        return found === null ? null : { range: range(position(call).line, found.from, found.to), placeholder: found.word };
    });
    service.respond(
        'textDocument/rename',
        (call) => {
            const { newName } = call.params as { newName: string };
            const text = textOf(service, call.uri);
            const found = wordAt(text, position(call));
            if (found === null) {
                return null;
            }
            const scope = scopeOf(text, position(call).line);
            const edits: TextEdit[] = usesOf(text, found.word, call.uri, scope.first, scope.last).map((use) => ({ range: use.range, newText: newName }));
            return { changes: { [call.uri]: edits } };
        },
        { prepareProvider: true }
    );
}

const MISSING_TYPE: Diagnostic = { range: range(3, 34, 43), severity: 1, code: 2304, source: 'ts', message: "Cannot find name 'OrderLine'." };

/* Reports the missing type as soon as the document is open, as a server does after its first check. */
export function reportProblems(service: FakeLanguageService): void {
    service.respond('open', (call) => {
        queueMicrotask(() =>
            service.report({
                uri: call.uri,
                source: 'ts',
                diagnostics: [MISSING_TYPE, { range: range(11, 35, 44), severity: 1, code: 2304, source: 'ts', message: "Cannot find name 'OrderLine'." }]
            })
        );
    });
}

export function respondCodeActions(service: FakeLanguageService): void {
    service.respond('textDocument/codeAction', (call) => [
        {
            title: "Add import from './order-line'",
            kind: 'quickfix',
            diagnostics: [MISSING_TYPE],
            isPreferred: true,
            edit: { changes: { [call.uri]: [{ range: range(0, 0, 0), newText: "import type { OrderLine } from './order-line';\n" }] } }
        },
        { title: 'Extract to function', kind: 'refactor.extract.function', disabled: { reason: 'Select the statements to extract first.' } }
    ]);
}
