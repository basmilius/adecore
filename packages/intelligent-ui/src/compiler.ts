import { safeKey, UiBudget, UiFailure, type UiLimits } from './budget.ts';
import { isUiComponent, UI_CATALOG, UI_CATALOG_VERSION } from './catalog.ts';
import { evaluateUiExpression, type UiExpression, type UiValue } from './expression.ts';
import { parseUiSyntax, uiDiagnostic, type UiDiagnostic, type UiSyntaxNode } from './syntax.ts';
import { type z } from 'zod';

export const UI_FENCE_LANGUAGE = 'ruimte-ui';

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
}

export interface UiBlock {
    id: string;
    catalogVersion: number;
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

function plain(value: UiValue): string {
    return value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
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
                        node.fallback = plain(evaluateUiExpression(syntax.expression, block.defaults, budget));
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
        const children = node.children.map((child) => child.fallback).join('');
        const label = fallbackProps.label ?? fallbackProps.title;
        const value = fallbackProps.value;
        const target = fallbackProps.path ?? fallbackProps.sha ?? (syntax.type === 'Node' ? fallbackProps.id : undefined);
        if (syntax.type === 'Stat') {
            node.fallback = `${plain(label ?? '')}: ${plain(value ?? '')}${fallbackProps.unit ? ` ${plain(fallbackProps.unit)}` : ''}\n`;
        } else if (syntax.type === 'Source') {
            node.fallback = `${plain(label ?? '')}: ${plain(fallbackProps.url ?? '')}\n`;
        } else if (syntax.type === 'Table') {
            node.fallback = `${plain(fallbackProps.rows ?? [])}\n`;
        } else if (syntax.type === 'Chart') {
            node.fallback = `${plain(fallbackProps.data ?? [])}\n`;
        } else if (syntax.type === 'Image') {
            node.fallback = `[Image: ${plain(fallbackProps.alt ?? fallbackProps.attachment ?? fallbackProps.generated ?? 'unavailable')}]${children}\n`;
        } else {
            node.fallback = `${label !== undefined ? `${plain(label)}: ` : ''}${target !== undefined ? `${plain(target)} ` : ''}${children}${fallbackProps.context ? `\n${plain(fallbackProps.context)}` : ''}`;
            if (syntax.type !== 'Tag' && !node.fallback.endsWith('\n')) {
                node.fallback += '\n';
            }
        }
        if (!node.fallback.trim()) {
            node.fallback = source.slice(syntax.start, Math.min(syntax.end, syntax.start + 1024));
        }
        return node;
    };
    try {
        const syntax = parseUiSyntax(source, options.id, options.final, budget);
        block.diagnostics = syntax.diagnostics;
        for (const [name, expression] of Object.entries(syntax.declarations)) {
            try {
                if (expression.kind === 'call' && expression.name === 'Query') {
                    if (expression.args.length !== 2 || !expression.args.every(isConstant)) {
                        throw new UiFailure('invalid_query', '@Query needs a literal source and literal argument record.');
                    }
                    const querySource = evaluateUiExpression(expression.args[0], {}, budget);
                    const args = evaluateUiExpression(expression.args[1], {}, budget);
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
                    block.queries[name] = { source: querySource, args };
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

export function compileUi(text: string, options: UiCompileOptions): UiBlock[] {
    const blocks: UiBlock[] = [];
    let fence: { marker: string; length: number; start: number; codeStart: number; ui: boolean } | null = null;
    let position = 0;
    for (const line of text.split(/(?<=\n)/)) {
        const opening = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/.exec(line);
        if (!fence && opening) {
            fence = {
                marker: opening[1][0],
                length: opening[1].length,
                start: position,
                codeStart: position + line.length,
                ui: opening[2].trim() === UI_FENCE_LANGUAGE
            };
        } else if (fence && opening && opening[1][0] === fence.marker && opening[1].length >= fence.length && !opening[2].trim()) {
            if (fence.ui) {
                const block = compileUiBlock(text.slice(fence.codeStart, position), { ...options, id: `${options.id}:ui:${fence.start}`, final: true });
                block.start = fence.start;
                block.end = position + line.length;
                blocks.push(block);
            }
            fence = null;
        }
        position += line.length;
    }
    if (fence?.ui) {
        const block = compileUiBlock(text.slice(fence.codeStart), { ...options, id: `${options.id}:ui:${fence.start}` });
        block.start = fence.start;
        block.end = text.length;
        blocks.push(block);
    }
    return blocks;
}
