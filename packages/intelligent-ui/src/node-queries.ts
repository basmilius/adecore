import type { UiBlock, UiNode } from './compiler.ts';

/*
 * The queries each written node of a block reads, by node id: the ones its own expressions name, and the ones
 * of an `Each` it stands in, whose items come from them. A node that reads none is left out. An evaluated node
 * finds its entry under its `sourceId`, or its own id when it has none.
 */
export function uiNodeQueries(block: UiBlock): Record<string, readonly string[]> {
    const names = new Set(Object.keys(block.queries));
    const queries: Record<string, readonly string[]> = Object.create(null);

    if (names.size === 0) {
        return queries;
    }

    const references = (value: unknown, into: Set<string>): void => {
        if (!value || typeof value !== 'object') {
            return;
        }

        const expression = value as Record<string, unknown>;

        if (expression.kind === 'reference' && names.has(String(expression.name))) {
            into.add(String(expression.name));
        }

        for (const child of Object.values(expression)) {
            if (Array.isArray(child)) {
                child.forEach((item) => references(item, into));
            } else if (typeof child === 'object') {
                references(child, into);
            }
        }
    };

    const walk = (nodes: readonly UiNode[], inherited: ReadonlySet<string>): void => {
        for (const node of nodes) {
            const related = new Set(inherited);
            references(node.expressions, related);

            if (related.size > 0) {
                queries[node.id] = [...related].sort();
            }

            walk(node.children, node.type === 'Each' ? related : inherited);
        }
    };

    walk(block.nodes, new Set());

    return queries;
}
