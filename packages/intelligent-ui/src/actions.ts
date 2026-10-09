import { UiFailure } from './budget.ts';
import { isUiComponent, UI_CATALOG } from './catalog.ts';
import type { UiBlock } from './compiler.ts';
import type { UiExpression } from './expression.ts';

/* The prop of a component that holds a state action, kept unevaluated, instead of a value. */
export function uiActionProp(type: string): string | undefined {
    if (!isUiComponent(type)) {
        return undefined;
    }
    const entry = UI_CATALOG[type];
    return 'action' in entry ? entry.action : undefined;
}

/*
 * The variable an action writes, or null for `@Reset()`, which restores them all. Throws for anything
 * but `@Set($name, value)`, `@Reset($name)` and `@Reset()` on a variable that `local` accepts.
 */
export function uiActionTarget(action: UiExpression, local: (name: string) => boolean): string | null {
    if (action.kind !== 'call' || (action.name !== 'Set' && action.name !== 'Reset')) {
        throw new UiFailure('refused_action', 'Expected @Set or @Reset.');
    }
    if (action.name === 'Reset' && action.args.length === 0) {
        return null;
    }
    if (action.args.length !== (action.name === 'Set' ? 2 : 1)) {
        throw new UiFailure('refused_action', 'Invalid state action arguments.');
    }
    const reference = action.args[0];
    if (reference.kind !== 'reference' || !local(reference.name)) {
        throw new UiFailure('refused_binding', 'The action needs a local state variable.');
    }
    return reference.name;
}

/* Whether `name` is local state of the block: declared with a default and never a query. */
export function uiLocalState(block: Pick<UiBlock, 'defaults' | 'queries'>): (name: string) => boolean {
    return (name) => Object.hasOwn(block.defaults, name) && !Object.hasOwn(block.queries, name);
}
