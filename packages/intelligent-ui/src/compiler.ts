import { safeKey, UiBudget, UiFailure, type UiLimits } from './budget.ts';
import { isUiComponent, UI_CATALOG, UI_CATALOG_VERSION } from './catalog.ts';
import { uiNodeFallback, uiPlainText } from './fallback.ts';
import { evaluateUiExpression, type UiExpression, type UiValue } from './expression.ts';
import { parseUiSyntax, uiDiagnostic, type UiDiagnostic, type UiSyntaxNode } from './syntax.ts';
import { type z } from 'zod';

// The info string a fence carries when the host names none of its own.
export const UI_FENCE_LANGUAGE = 'ui';

export const UI_REPLY_LIMITS = { blocks: 16, characters: 262144, nodes: 2048, milliseconds: 60 } as const;

export interface UiNode {
    id: string;
    type: string;
    props: Record<string, UiValue>;
    expressions: Record<string, UiExpression>;
    bindings: Record<string, string>;
    children: UiNode[];
    complete: boolean;
    fallback: string;
    error?: string;
    start: number;
    end: number;
}

export interface UiQuery {
    source: string;
    args: Record<string, UiValue>;
    expression?: UiExpression;
}

export interface UiBlock {
    id: string;
    catalogVersion: number;
    revision?: string;
    start: number;
    end: number;
    complete: boolean;
    defaults: Record<string, UiValue>;
    queries: Record<string, UiQuery>;
    nodes: UiNode[];
    diagnostics: UiDiagnostic[];
    fallback: string;
}

export interface UiCompileOptions {
    id: string;
    final?: boolean;
    limits?: Partial<UiLimits>;
    latestAttachment?: string;
    querySchemas?: Readonly<Record<string, z.ZodType>>;
    // The info string that marks a UI fence; `UI_FENCE_LANGUAGE` without one.
    fenceLanguage?: string;
    now?: () => number;
}

function isConstant(expression: UiExpression): boolean {
    switch (expression.kind) {
        case 'literal':
            return true;
        case 'array':
            return expression.items.every(isConstant);
        case 'object':
            return expression.entries.every((entry) => isConstant(entry.value));
        case 'unary':
            return ['-', '+'].includes(expression.operator) && isConstant(expression.value);
        default:
            return false;
    }
}

export function compileUiBlock(source: string, options: UiCompileOptions): UiBlock {
    const budget = new UiBudget(options.limits, options.now);
    const block: UiBlock = {
        id: options.id,
        catalogVersion: UI_CATALOG_VERSION,
        start: 0,
        end: source.length,
        complete: options.final ?? false,
        defaults: Object.create(null),
        queries: Object.create(null),
        nodes: [],
        diagnostics: [],
        fallback: ''
    };
    const diagnose = (error: unknown, start: number, end: number, nodeId?: string) => {
        if (block.diagnostics.length < budget.limits.diagnostics) {
            block.diagnostics.push(uiDiagnostic(error, start, end, nodeId));
        }
    };
    const compile = (syntax: UiSyntaxNode, parent?: string): UiNode => {
        budget.depth(0);
        const node: UiNode = {
            id: syntax.id,
            type: syntax.type,
            props: Object.create(null),
            expressions: Object.create(null),
            bindings: Object.create(null),
            children: [],
            complete: syntax.complete,
            fallback: '',
            start: syntax.start,
            end: syntax.end
        };
        let fallbackProps = node.props;
        try {
            if (syntax.type === '$text') {
                if (syntax.expression) {
                    node.expressions.text = syntax.expression;
                    try {
                        node.fallback = uiPlainText(evaluateUiExpression(syntax.expression, block.defaults, budget));
                    } catch (error) {
                        if (error instanceof UiFailure && error.code === 'budget_exceeded') {
                            throw error;
                        }
                    }
                } else {
                    node.props.text = syntax.text ?? '';
                    node.fallback = syntax.text ?? '';
                }
                return node;
            }
            if (!isUiComponent(syntax.type)) {
                throw new UiFailure('unknown_component', `Unknown component ${syntax.type}.`);
            }
            const entry = UI_CATALOG[syntax.type];
            if ('parent' in entry && entry.parent !== parent) {
                throw new UiFailure('invalid_parent', `${syntax.type} belongs inside ${entry.parent}.`);
            }
            if (parent && isUiComponent(parent)) {
                const container = UI_CATALOG[parent];
                if (
                    'children' in container &&
                    !(container.children as readonly string[]).includes(syntax.type) &&
                    syntax.type !== 'Show' &&
                    syntax.type !== 'Each'
                ) {
                    throw new UiFailure('invalid_child', `${syntax.type} is not a child of ${parent}.`);
                }
            }
            for (const [key, expression] of Object.entries(syntax.props)) {
                safeKey(key);
                if (!Object.hasOwn(entry.schema.shape, key)) {
                    diagnose(new UiFailure('refused_prop', `${syntax.type} does not accept ${key}.`), syntax.start, syntax.end, syntax.id);
                    continue;
                }
                if (isConstant(expression)) {
                    node.props[key] = evaluateUiExpression(expression, {}, budget);
                } else {
                    node.expressions[key] = expression;
                    if (
                        'binding' in entry &&
                        entry.binding === key &&
                        expression.kind === 'reference' &&
                        Object.hasOwn(block.defaults, expression.name) &&
                        !Object.hasOwn(block.queries, expression.name)
                    ) {
                        node.bindings[key] = expression.name;
                    }
                }
            }
            if (syntax.type === 'Image' && node.props.generated === 'latest' && options.latestAttachment) {
                delete node.props.generated;
                node.props.attachment = options.latestAttachment;
            }
            const evaluated: Record<string, UiValue> = { ...node.props };
            fallbackProps = evaluated;
            let unresolved = false;
            for (const [key, expression] of Object.entries(node.expressions)) {
                try {
                    evaluated[key] = evaluateUiExpression(expression, block.defaults, budget);
                } catch (error) {
                    if (error instanceof UiFailure && error.code === 'budget_exceeded') {
                        throw error;
                    }
                    unresolved = true;
                }
            }
            // Each locals and live query data are only available to the client evaluator.
            if (!unresolved && syntax.complete) {
                const parsed = entry.schema.safeParse(evaluated);
                if (!parsed.success) {
                    throw new UiFailure('invalid_props', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
                }
            }
        } catch (error) {
            if (error instanceof UiFailure && error.code === 'budget_exceeded') {
                throw error;
            }
            node.error = error instanceof UiFailure ? error.code : 'invalid_props';
            diagnose(error, syntax.start, syntax.end, syntax.id);
        }
        const effectiveParent = syntax.type === 'Show' || syntax.type === 'Each' ? parent : syntax.type;
        node.children = syntax.children.map((child) => compile(child, effectiveParent));
        node.fallback = uiNodeFallback(syntax.type, fallbackProps, node.children.map((child) => child.fallback).join(''));
        if (!node.fallback.trim()) {
            node.fallback = source.slice(syntax.start, Math.min(syntax.end, syntax.start + 1024));
        }
        return node;
    };
    try {
        const syntax = parseUiSyntax(source, options.id, options.final, budget);
        block.diagnostics = syntax.diagnostics;
        for (const [name, expression] of Object.entries(syntax.declarations).sort(
            ([, a], [, b]) => Number(a.kind === 'call' && a.name === 'Query') - Number(b.kind === 'call' && b.name === 'Query')
        )) {
            try {
                if (expression.kind === 'call' && expression.name === 'Query') {
                    if (expression.args.length !== 2 || !isConstant(expression.args[0]) || expression.args[1].kind !== 'object') {
                        throw new UiFailure('invalid_query', '@Query needs a literal source and an argument record.');
                    }
                    const querySource = evaluateUiExpression(expression.args[0], {}, budget);
                    const argument = expression.args[1];
                    const references = (part: unknown): void => {
                        if (!part || typeof part !== 'object') {
                            return;
                        }
                        if ('kind' in part && part.kind === 'reference' && 'name' in part && !Object.hasOwn(block.defaults, String(part.name))) {
                            throw new UiFailure('invalid_query', 'Query arguments may reference only declared local state.');
                        }
                        for (const value of Object.values(part)) {
                            references(value);
                        }
                    };
                    references(argument);
                    const args = evaluateUiExpression(argument, block.defaults, budget);
                    if (typeof querySource !== 'string' || !args || Array.isArray(args) || typeof args !== 'object') {
                        throw new UiFailure('invalid_query', 'Invalid query source or argument record.');
                    }
                    if (!options.querySchemas || !Object.hasOwn(options.querySchemas, querySource)) {
                        throw new UiFailure('unknown_query', 'The host did not register this query source.');
                    }
                    const checked = options.querySchemas[querySource].safeParse(args);
                    if (!checked.success) {
                        throw new UiFailure('invalid_query', 'Query arguments do not match the host schema.');
                    }
                    if (Object.keys(block.queries).length >= 8) {
                        throw new UiFailure('budget_exceeded', 'A block may declare at most eight queries.');
                    }
                    block.queries[name] = { source: querySource, args, ...(!isConstant(argument) ? { expression: argument } : {}) };
                } else {
                    if (!isConstant(expression)) {
                        throw new UiFailure('invalid_default', 'State defaults must be literal JSON values.');
                    }
                    block.defaults[name] = evaluateUiExpression(expression, {}, budget);
                }
            } catch (error) {
                if (error instanceof UiFailure && error.code === 'budget_exceeded') {
                    throw error;
                }
                diagnose(error, 0, source.length);
            }
        }
        block.nodes = syntax.nodes.map((node) => compile(node));
        block.fallback = block.nodes
            .map((node) => node.fallback)
            .join('')
            .trim();
    } catch (error) {
        block.nodes = [];
        block.defaults = Object.create(null);
        block.queries = Object.create(null);
        block.diagnostics = [uiDiagnostic(error, 0, source.length)];
        block.fallback = source.slice(0, budget.limits.characters);
    }
    if (!block.fallback.trim()) {
        block.fallback = source.slice(0, budget.limits.characters);
    }
    return block;
}

export type UiCompilerOptions = Omit<UiCompileOptions, 'final' | 'latestAttachment'>;
export type UiCompileUpdate = Pick<UiCompileOptions, 'final' | 'latestAttachment'>;

interface CachedUiBlock {
    source: string;
    block: UiBlock;
    latestAttachment?: string;
}

export class UiCompiler {
    private readonly options: UiCompilerOptions;
    private cache = new Map<number, CachedUiBlock>();

    constructor(options: UiCompilerOptions) {
        this.options = options;
    }

    compile(text: string, update: UiCompileUpdate = {}): UiBlock[] {
        const blocks: UiBlock[] = [];
        const next = new Map<number, CachedUiBlock>();
        let fence: { marker: string; length: number; start: number; codeStart: number; ui: boolean } | null = null;
        let position = 0;
        let characters = 0;
        let nodes = 0;
        let exhausted = false;
        const now = this.options.now ?? Date.now;
        const language = this.options.fenceLanguage ?? UI_FENCE_LANGUAGE;
        const started = now();
        const nodeCount = (items: readonly UiNode[]): number => items.reduce((count, node) => count + 1 + nodeCount(node.children), 0);
        const rejected = (start: number, codeStart: number, codeEnd: number, end: number, complete: boolean): UiBlock => ({
            id: `${this.options.id}:ui:${start}`,
            catalogVersion: UI_CATALOG_VERSION,
            start,
            end,
            complete,
            defaults: {},
            queries: {},
            nodes: [],
            fallback: text.slice(codeStart, Math.min(codeEnd, codeStart + 4096)),
            diagnostics: [uiDiagnostic(new UiFailure('budget_exceeded', 'This reply exceeded its UI budget; remaining fences stay text.'), start, end)]
        });
        const append = (start: number, codeStart: number, codeEnd: number, end: number, closed: boolean) => {
            if (exhausted) {
                return;
            }
            if (blocks.length >= UI_REPLY_LIMITS.blocks) {
                const last = blocks.at(-1)!;
                blocks[blocks.length - 1] = {
                    ...last,
                    diagnostics: [
                        ...last.diagnostics.slice(0, 19),
                        uiDiagnostic(new UiFailure('budget_exceeded', 'Further UI fences stay text because this reply has too many blocks.'), start, end)
                    ]
                };
                exhausted = true;
                return;
            }
            const complete = closed || update.final === true;
            characters += codeEnd - codeStart;
            if (characters > UI_REPLY_LIMITS.characters || now() - started > UI_REPLY_LIMITS.milliseconds) {
                blocks.push(rejected(start, codeStart, codeEnd, end, complete));
                exhausted = true;
                return;
            }
            const source = text.slice(codeStart, codeEnd);
            const cached = this.cache.get(start);
            const unchanged =
                !update.final &&
                cached?.source === source &&
                cached.block.end === end &&
                cached.block.complete === complete &&
                cached.latestAttachment === update.latestAttachment;
            const block = unchanged
                ? cached.block
                : compileUiBlock(source, {
                      ...this.options,
                      ...update,
                      id: `${this.options.id}:ui:${start}`,
                      final: complete
                  });
            nodes += nodeCount(block.nodes);
            if (nodes > UI_REPLY_LIMITS.nodes) {
                blocks.push(rejected(start, codeStart, codeEnd, end, complete));
                exhausted = true;
                return;
            }
            block.start = start;
            block.end = end;
            blocks.push(block);
            next.set(start, { source, block, latestAttachment: update.latestAttachment });
        };
        while (position < text.length && !exhausted) {
            const newline = text.indexOf('\n', position);
            const end = newline === -1 ? text.length : newline + 1;
            const line = text.slice(position, end);
            const opening = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/.exec(line);
            if (!fence && opening) {
                fence = {
                    marker: opening[1][0],
                    length: opening[1].length,
                    start: position,
                    codeStart: position + line.length,
                    ui: opening[2].trim() === language
                };
            } else if (fence && opening && opening[1][0] === fence.marker && opening[1].length >= fence.length && !opening[2].trim()) {
                if (fence.ui) {
                    append(fence.start, fence.codeStart, position, position + line.length, true);
                }
                fence = null;
            }
            position = end;
        }
        if (fence?.ui) {
            append(fence.start, fence.codeStart, text.length, text.length, false);
        }
        this.cache = next;
        return blocks;
    }

    clear(): void {
        this.cache.clear();
    }
}

/* A cheap test for whether `text` opens a UI fence at all, before a compiler is worth creating. */
export function uiHasFence(text: string, fenceLanguage: string = UI_FENCE_LANGUAGE): boolean {
    const language = fenceLanguage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^ {0,3}(?:\`{3,}|~{3,})[ \\t]*${language}[ \\t]*\\r?$`, 'm').test(text);
}

export function compileUi(text: string, options: UiCompileOptions): UiBlock[] {
    return new UiCompiler(options).compile(text, options);
}
