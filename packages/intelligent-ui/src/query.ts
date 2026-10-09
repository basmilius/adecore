import { UI_CATALOG_VERSION } from './catalog.ts';
import { UiBudget, UiFailure } from './budget.ts';
import type { UiBlock, UiNode } from './compiler.ts';
import { uiNodeFallback } from './fallback.ts';
import { copyUiValue, evaluateUiExpression, type UiValue } from './expression.ts';
import { evaluateUiBlock, uiInputValues, UiState, type UiViewNode } from './runtime.ts';

function findBinding(nodes: readonly UiNode[], id: string, prop: string): string | undefined {
    for (const node of nodes) {
        if (node.id === id) {
            return node.bindings[prop];
        }
        const found = findBinding(node.children, id, prop);
        if (found) {
            return found;
        }
    }
    return undefined;
}

export function uiValidatedState(block: UiBlock, input: Readonly<Record<string, unknown>> = {}, queries: Readonly<Record<string, unknown>> = {}): UiState {
    if (!block.complete || block.catalogVersion !== UI_CATALOG_VERSION) {
        throw new UiFailure('invalid_block', 'Only completed supported blocks can resolve input.');
    }
    const values = copyUiValue(input, new UiBudget()) as Record<string, UiValue>;
    const state = new UiState(block);
    for (const [name, value] of Object.entries(queries)) {
        state.setQuery(name, value, block);
    }
    const allowed = uiInputValues(block, state);
    for (const [key, value] of Object.entries(values)) {
        if (!Object.hasOwn(allowed, key)) {
            throw new UiFailure('refused_binding', 'Only declared input bindings can be submitted.');
        }
        state.set(key, value);
    }
    const visible = new Set<string>();
    const visit = (nodes: readonly UiViewNode[]) => {
        for (const node of nodes) {
            if (node.error || !node.complete) {
                continue;
            }
            let valid = true;
            if (node.type === 'Segmented') {
                valid = node.children.some((option) => option.type === 'Option' && !option.error && option.props.value === node.props.value);
            }
            if (node.type === 'Checklist') {
                const options = node.children.filter((item) => item.type === 'Item' && !item.error).map((item) => item.props.value);
                valid = (node.props.value as unknown[]).every((value) => options.includes(value));
            }
            if (valid) {
                for (const [key, binding] of Object.entries(node.bindings)) {
                    const original = findBinding(block.nodes, node.sourceId ?? node.id, key);
                    if (original && binding) {
                        visible.add(original);
                    }
                }
            }
            visit(node.children);
        }
    };
    const evaluated = evaluateUiBlock(block, state);
    if (evaluated.diagnostics.some((diagnostic) => diagnostic.code === 'budget_exceeded')) {
        throw new UiFailure('budget_exceeded', 'The query inputs exceeded their evaluation budget.');
    }
    visit(evaluated.nodes);
    for (const [key, value] of Object.entries(values)) {
        if (JSON.stringify(value) !== JSON.stringify(allowed[key]) && !visible.has(key)) {
            throw new UiFailure('invalid_value', 'An input value is outside the visible control’s allowed values.');
        }
    }
    return state;
}

export function uiQueryArguments(block: UiBlock, name: string, input: Readonly<Record<string, unknown>> = {}): Record<string, UiValue> {
    if (!Object.hasOwn(block.queries, name)) {
        throw new UiFailure('invalid_query', 'This block does not declare that query.');
    }
    const state = uiValidatedState(block, input);
    const query = block.queries[name];
    return query.expression
        ? (evaluateUiExpression(query.expression, state.scope(), new UiBudget()) as Record<string, UiValue>)
        : (copyUiValue(query.args, new UiBudget()) as Record<string, UiValue>);
}

export function uiQueryFallback(block: UiBlock, queries: Readonly<Record<string, unknown>>): string {
    const state = new UiState(block);
    for (const [name, value] of Object.entries(queries)) {
        state.setQuery(name, value, block);
    }
    const text = (nodes: readonly UiViewNode[]): string =>
        nodes.map((node) => (node.error ? node.fallback : uiNodeFallback(node.type, node.props, text(node.children)))).join('');
    return text(evaluateUiBlock(block, state).nodes).trim() || block.fallback;
}
