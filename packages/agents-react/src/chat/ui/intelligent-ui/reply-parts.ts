import type { UiBlock } from '@adecore/intelligent-ui';

export type UiReplyPart = { kind: 'text'; text: string } | { kind: 'ui'; block: UiBlock };

export function uiReplyParts(text: string, blocks: readonly UiBlock[], streaming = false): UiReplyPart[] {
    const parts: UiReplyPart[] = [];
    let position = 0;
    for (const block of [...blocks].sort((left, right) => left.start - right.start)) {
        if (!Number.isInteger(block.start) || !Number.isInteger(block.end) || block.start < position || block.end < block.start || block.end > text.length) {
            continue;
        }
        if (block.start > position) {
            parts.push({ kind: 'text', text: text.slice(position, block.start) });
        }
        parts.push({ kind: 'ui', block });
        position = streaming && !block.complete ? text.length : block.end;
    }
    if (position < text.length) {
        parts.push({ kind: 'text', text: text.slice(position) });
    }
    return parts;
}
