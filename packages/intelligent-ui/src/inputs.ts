import type { UiBlock, UiNode } from './compiler.ts';
import type { UiViewNode } from './runtime.ts';

export function uiCompiledNodes(nodes: readonly UiNode[], into = new Map<string, UiNode>()): Map<string, UiNode> {
    for (const node of nodes) {
        into.set(node.id, node);
        uiCompiledNodes(node.children, into);
    }
    return into;
}

/* Whether a control's value is one its own visible options offer. */
function offered(node: UiViewNode): boolean {
    if (node.type === 'Segmented') {
        return node.children.some((option) => option.type === 'Option' && !option.error && option.props.value === node.props.value);
    }
    if (node.type === 'Checklist') {
        const options = node.children.filter((item) => item.type === 'Item' && !item.error).map((item) => item.props.value);
        return (node.props.value as unknown[]).every((value) => options.includes(value));
    }
    return true;
}

/*
 * The variables whose current value a visible, complete control of the evaluated tree holds within what it
 * offers. A submitted value outside this set is one no person could have produced on the screen.
 */
export function uiVisibleInputs(block: UiBlock, nodes: readonly UiViewNode[]): Set<string> {
    const written = uiCompiledNodes(block.nodes);
    const inputs = new Set<string>();
    const visit = (views: readonly UiViewNode[]) => {
        for (const node of views) {
            if (node.error || !node.complete) {
                continue;
            }
            const source = written.get(node.sourceId ?? node.id);
            if (source && offered(node)) {
                for (const prop of Object.keys(node.bindings)) {
                    if (source.bindings[prop]) {
                        inputs.add(source.bindings[prop]);
                    }
                }
            }
            visit(node.children);
        }
    };
    visit(nodes);
    return inputs;
}
