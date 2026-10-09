import { copyUiValue, evaluateUiExpression, type UiExpression, type UiValue } from './expression.ts';
import { UiBudget, UiFailure, type UiLimits } from './budget.ts';
import { isUiComponent, UI_CATALOG, UI_CATALOG_VERSION } from './catalog.ts';
import { type UiBlock, type UiNode } from './compiler.ts';
import { uiDiagnostic, type UiDiagnostic } from './syntax.ts';

export interface UiBinding<Value> {
    value: Value;
    onValueChange(value: Value): void;
}

export interface UiViewNode<Props = Record<string, unknown>> {
    id: string;
    type: string;
    props: Props;
    bindings: Readonly<Record<string, UiBinding<unknown>>>;
    children: UiViewNode[];
    complete: boolean;
    fallback: string;
    error?: string;
}

export interface UiEvaluation {
    nodes: UiViewNode[];
    diagnostics: UiDiagnostic[];
}

export class UiState {
    private id = '';
    private defaults: Record<string, UiValue> = Object.create(null);
    private values: Record<string, UiValue> = Object.create(null);
    private queries: Record<string, UiValue> = Object.create(null);
    private querySignatures: Record<string, string> = Object.create(null);
    private readonly listeners = new Set<() => void>();
    private revision = 0;

    constructor(block: UiBlock) {
        this.sync(block);
    }

    sync(block: UiBlock): void {
        const defaults = copyUiValue(block.defaults) as Record<string, UiValue>;
        if (this.id !== block.id) {
            this.values = Object.create(null);
            this.queries = Object.create(null);
        }
        for (const [name, value] of Object.entries(defaults)) {
            if (this.id !== block.id || !Object.hasOwn(this.defaults, name) || JSON.stringify(this.defaults[name]) !== JSON.stringify(value)) {
                this.values[name] = value;
            }
        }
        for (const name of Object.keys(this.values)) {
            if (!Object.hasOwn(defaults, name)) {
                delete this.values[name];
            }
        }
        for (const name of Object.keys(this.queries)) {
            if (!Object.hasOwn(block.queries, name) || this.querySignatures[name] !== JSON.stringify(block.queries[name])) {
                delete this.queries[name];
            }
        }
        this.querySignatures = Object.create(null);
        for (const [name, query] of Object.entries(block.queries)) {
            this.querySignatures[name] = JSON.stringify(query);
        }
        this.id = block.id;
        this.defaults = defaults;
    }

    snapshot(): number {
        return this.revision;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    scope(): Readonly<Record<string, UiValue>> {
        return copyUiValue({ ...this.values, ...this.queries }) as Record<string, UiValue>;
    }

    set(name: string, value: unknown): void {
        if (!Object.hasOwn(this.defaults, name)) {
            throw new UiFailure('refused_binding', 'Only declared local state can be changed.');
        }
        const next = copyUiValue(value);
        const initial = this.defaults[name];
        if (Array.isArray(next) !== Array.isArray(initial) || typeof next !== typeof initial || (next === null) !== (initial === null)) {
            throw new UiFailure('invalid_value', 'The state type cannot change.');
        }
        this.values[name] = next;
        this.changed();
    }

    setQuery(name: string, value: unknown, block: UiBlock): void {
        if (block.id !== this.id || !Object.hasOwn(block.queries, name) || this.querySignatures[name] !== JSON.stringify(block.queries[name])) {
            throw new UiFailure('refused_query', 'The query must belong to this block.');
        }
        this.queries[name] = copyUiValue(value);
        this.changed();
    }

    run(action: UiExpression): void {
        if (action.kind !== 'call' || !['Set', 'Reset'].includes(action.name)) {
            throw new UiFailure('refused_action', 'Expected @Set or @Reset.');
        }
        if (action.name === 'Reset' && action.args.length === 0) {
            this.values = copyUiValue(this.defaults) as Record<string, UiValue>;
            this.changed();
            return;
        }
        const reference = action.args[0];
        if (!reference || reference.kind !== 'reference' || !Object.hasOwn(this.defaults, reference.name)) {
            throw new UiFailure('refused_binding', 'The action needs a local state variable.');
        }
        if (action.name === 'Set' && action.args.length === 2) {
            this.set(reference.name, evaluateUiExpression(action.args[1], this.scope()));
        } else if (action.name === 'Reset' && action.args.length === 1) {
            this.set(reference.name, this.defaults[reference.name]);
        } else {
            throw new UiFailure('refused_action', 'Invalid state action arguments.');
        }
    }

    private changed(): void {
        this.revision += 1;
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export function evaluateUiBlock(block: UiBlock, state = new UiState(block), limits: Partial<UiLimits> = {}): UiEvaluation {
    const budget = new UiBudget(limits);
    const result: UiEvaluation = { nodes: [], diagnostics: [] };
    const scope = state.scope();
    let exhausted = false;
    const children = (nodes: UiNode[], variables: Readonly<Record<string, UiValue>>, depth: number, suffix: string): UiViewNode[] => {
        const output: UiViewNode[] = [];
        for (const node of nodes) {
            if (exhausted) {
                break;
            }
            output.push(...visit(node, variables, depth, suffix));
        }
        return output;
    };
    const visit = (node: UiNode, variables: Readonly<Record<string, UiValue>>, depth: number, suffix = ''): UiViewNode[] => {
        const view: UiViewNode = {
            id: `${node.id}${suffix}`,
            type: node.type,
            props: {},
            bindings: {},
            children: [],
            complete: node.complete,
            fallback: node.fallback
        };
        try {
            budget.depth(depth);
            budget.node();
            if (block.catalogVersion !== UI_CATALOG_VERSION || node.error) {
                throw new UiFailure(node.error ?? 'unknown_catalog', 'This part uses an unsupported UI definition.');
            }
            const props: Record<string, UiValue> = copyUiValue(node.props, budget) as Record<string, UiValue>;
            for (const [key, expression] of Object.entries(node.expressions)) {
                props[key] = evaluateUiExpression(expression, variables, budget);
            }
            if (node.type === '$text') {
                if (typeof props.text !== 'string' && typeof props.text !== 'number' && typeof props.text !== 'boolean' && props.text !== null) {
                    throw new UiFailure('invalid_value', 'Text must be a scalar.');
                }
                view.props = { text: props.text === null ? '' : String(props.text) };
                return [view];
            }
            if (!isUiComponent(node.type)) {
                throw new UiFailure('unknown_component', `Unknown component ${node.type}.`);
            }
            const entry = UI_CATALOG[node.type];
            const parsed = entry.schema.safeParse(props);
            if (!parsed.success) {
                throw new UiFailure('invalid_props', parsed.error.issues.map((issue) => issue.message).join('; '));
            }
            view.props = parsed.data;
            if (node.type === 'Show') {
                return props.when ? children(node.children, variables, depth + 1, suffix) : [];
            }
            if (node.type === 'Each') {
                const items = props.items as UiValue[];
                const name = props.as as string;
                const expanded: UiViewNode[] = [];
                // Reserve all iterations before allocating children, including nested Each blocks.
                budget.iteration(items.length);
                for (let i = 0; i < items.length; i++) {
                    for (const child of node.children) {
                        expanded.push(...visit(child, { ...variables, [name]: items[i] }, depth + 1, `${suffix}:${i}`));
                        if (exhausted) {
                            throw new UiFailure('budget_exceeded', 'The repeated children exceeded their budget.');
                        }
                    }
                }
                return expanded;
            }
            const bindings: Record<string, UiBinding<unknown>> = Object.create(null);
            for (const [key, name] of Object.entries(node.bindings)) {
                if (!('binding' in entry) || entry.binding !== key || !Object.hasOwn(block.defaults, name) || Object.hasOwn(block.queries, name)) {
                    throw new UiFailure('refused_binding', 'The binding must target declared local input state.');
                }
                bindings[key] = {
                    value: props[key],
                    onValueChange(value: unknown) {
                        if (!node.complete) {
                            return;
                        }
                        const changed = entry.schema.safeParse({ ...props, [key]: value });
                        if (changed.success) {
                            state.set(name, value);
                        }
                    }
                };
            }
            view.bindings = bindings;
            view.children = children(node.children, variables, depth + 1, suffix);
            return [view];
        } catch (error) {
            if (error instanceof UiFailure && error.code === 'budget_exceeded') {
                exhausted = true;
            }
            view.error = error instanceof UiFailure ? error.code : 'invalid_value';
            if (result.diagnostics.length < budget.limits.diagnostics) {
                result.diagnostics.push(uiDiagnostic(error, node.start, node.end, node.id));
            }
            return [view];
        }
    };
    try {
        result.nodes = children(block.nodes, scope, 0, '');
    } catch (error) {
        result.diagnostics = [uiDiagnostic(error, block.start, block.end)];
    }
    return result;
}
