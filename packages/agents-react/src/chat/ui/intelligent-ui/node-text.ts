import type { TFunction } from 'i18next';
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

/*
 * Scrolls the Source row of `nodeId` under `root` into view and focuses it, which lights the row once.
 * Opens enclosing tabs and sections first; false when the source is absent.
 */
export async function revealUiSource(root: ParentNode, nodeId: string, ancestors: readonly string[] = []): Promise<boolean> {
    for (const id of ancestors) {
        const control = [...root.querySelectorAll<HTMLButtonElement>('[data-ui-reveal]')].find((element) => element.dataset.uiReveal === id);
        if (control && (control.getAttribute('aria-expanded') === 'false' || control.getAttribute('aria-selected') === 'false')) {
            control.click();
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }
    const row = [...root.querySelectorAll<HTMLElement>('[data-ui-source]')].find((element) => element.dataset.uiSource === nodeId);
    if (row === undefined) {
        return false;
    }
    // The light runs when focus arrives, so a row that already has it lets go first.
    if (row.ownerDocument.activeElement === row) {
        row.blur();
    }
    row.focus({ preventScroll: true });
    const reduced = row.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    return true;
}

/* The reason codes this version says in its own words; any other code reads as the reason the machine gave. */
const UI_REASON_CODES = new Set([
    'access-unavailable',
    'block-stale',
    'busy',
    'link-unchecked',
    'link-unsupported',
    'links-unsupported',
    'query-undeclared',
    'refresh-limit',
    'result-too-large',
    'snapshot-too-large',
    'source-unregistered',
    'stale-read',
    'timed-out',
    'unreadable'
]);

/* Why a reading failed or a link stayed plain, in the person's language where the code is known. */
export function uiReasonText(t: TFunction<'agent-chat'>, code: string | undefined, reason: string | undefined): string | undefined {
    return code !== undefined && UI_REASON_CODES.has(code) ? t(`blocks.live.reasons.${code}`) : reason;
}

/*
 * A number with its unit, where a percent sign hugs the number and every other unit stands apart
 * from it, by a space that never lets the two wrap apart.
 */
export function uiWithUnit(text: string, unit: string | undefined): string {
    if (unit === undefined || unit === '') {
        return text;
    }
    return unit === '%' ? `${text}${unit}` : `${text}\u00a0${unit}`;
}
