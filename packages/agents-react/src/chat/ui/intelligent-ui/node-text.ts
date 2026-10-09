import type { UiComponentName, UiProps, UiViewNode } from '@adecore/intelligent-ui';

/* The text a node holds, every `$text` below it joined as written, such as the code of a CodeBlock. */
export function uiNodeText(node: UiViewNode): string {
    return node.children.map((child) => (child.type === '$text' ? String(child.props.text ?? '') : uiNodeText(child))).join('');
}

/* The same text on one line, for a name a control or a screen reader needs as a string. */
export function uiNodeLabel(node: UiViewNode): string {
    return uiNodeText(node).replace(/\s+/g, ' ').trim();
}

/* The valid children of one kind, which a parent reads as metadata: the columns of a table, the tabs of a strip. */
export function uiChildrenOf<Name extends UiComponentName>(node: UiViewNode, type: Name): UiViewNode<UiProps<Name>>[] {
    return node.children.filter((child) => child.type === type && child.error === undefined) as UiViewNode<UiProps<Name>>[];
}

/* A Summary draws its text as inline Markdown, so the name it gives its block leaves out the code ticks, the strong marks and the address of a link. */
function withoutMarks(text: string): string {
    return text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*|`/g, '')
        .trim();
}

/* The Summary that heads a block, which is its first node; a Summary further down is a subheading. */
export function uiBlockHead(nodes: readonly UiViewNode[]): { id: string; label: string } | null {
    const first = nodes[0];
    if (first === undefined || first.type !== 'Summary' || first.error !== undefined) {
        return null;
    }
    return { id: first.id, label: withoutMarks(uiNodeLabel(first)) };
}
