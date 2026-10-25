import type { ChatAssistantItem, ChatUserItem } from '@adecore/agent-contracts';
import { copyText } from '@adecore/ui';
import { referenceTokens } from '../chat-references';
import {
    clipboardChipsOf,
    hasClipboardChips,
    tokenizeChips,
    tokenizeNamedReferences,
    writeClipboardChips,
    type ChipSegment,
    type ClipboardChips
} from '../mentions';
import type { TimelineRow } from '../logic/timeline';
import type { ReferenceLookup } from './reference-lookup';

/* The chips a copy of a whole message carries: what the person picked, or what a reply names. */
export function messageClipboardChips(
    item: ChatUserItem | ChatAssistantItem,
    text: string,
    lookup: Pick<ReferenceLookup, 'items' | 'referenced'>
): ClipboardChips {
    if (item.kind === 'assistant') {
        return clipboardChipsOf(text, tokenizeNamedReferences(text, lookup.items, lookup.referenced));
    }
    const tokens = referenceTokens([...(item.chats ?? []), ...(item.references ?? [])], lookup.items);
    return clipboardChipsOf(text, tokenizeChips(text, item.mentions ?? [], item.skills ?? [], tokens));
}

/* The chips a copy of a row of the thread carries; only a message has any. */
export function rowClipboardChips(row: TimelineRow, text: string, lookup: Pick<ReferenceLookup, 'items' | 'referenced'>): ClipboardChips {
    if (row.kind === 'user' || row.kind === 'assistant') {
        return messageClipboardChips(row.item, text, lookup);
    }
    return clipboardChipsOf(text, []);
}

/* What a chip the transcript drew stands for, read back from the attributes `TokenChip` writes. */
function segmentOf(chip: Element): ChipSegment | null {
    const value = chip.getAttribute('data-chip-value');
    if (value === null) {
        return null;
    }
    switch (chip.getAttribute('data-chip')) {
        case 'mention':
            return { kind: 'mention', path: value };
        case 'skill':
            return { kind: 'skill', name: value };
        case 'reference': {
            const name = chip.getAttribute('data-chip-name');
            return name === null || name === '' ? null : { kind: 'reference', id: value, name };
        }
        default:
            return null;
    }
}

/* The chips a selection holds whole, beside the text it copies; a chip cut in half is only text. */
export function selectionChips(selection: Selection): ClipboardChips {
    const segments: ChipSegment[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
        const container = selection.getRangeAt(i).commonAncestorContainer;
        const root = container instanceof Element ? container : container.parentElement;
        const own = root?.closest('[data-chip]');
        const candidates = own ? [own] : [...(root?.querySelectorAll('[data-chip]') ?? [])];
        for (const chip of candidates) {
            const segment = selection.containsNode(chip, false) ? segmentOf(chip) : null;
            if (segment !== null) {
                segments.push(segment);
            }
        }
    }
    return clipboardChipsOf(selection.toString(), segments);
}

/* A copy of a selection in the thread, which carries the chips in it as well when it holds any. */
export function copySelectionWithChips(event: ClipboardEvent): void {
    const selection = document.getSelection();
    if (event.defaultPrevented || event.clipboardData === null || selection === null || selection.isCollapsed) {
        return;
    }
    const chips = selectionChips(selection);
    if (!hasClipboardChips(chips)) {
        return;
    }
    writeClipboardChips(event.clipboardData, chips);
    event.preventDefault();
}

/*
 * Copies a text and its chips. The asynchronous clipboard writes no type of an app's own that a paste
 * can read, so the copy goes through a copy event, which only a page with the user's gesture gets.
 */
export function copyWithChips(chips: ClipboardChips): void {
    if (!hasClipboardChips(chips) || typeof document.execCommand !== 'function') {
        void copyText(chips.text);
        return;
    }
    let written = false;
    const write = (event: ClipboardEvent): void => {
        if (event.clipboardData !== null) {
            writeClipboardChips(event.clipboardData, chips);
            event.preventDefault();
            written = true;
        }
    };
    document.addEventListener('copy', write, true);
    try {
        document.execCommand('copy');
    } finally {
        document.removeEventListener('copy', write, true);
    }
    if (!written) {
        void copyText(chips.text);
    }
}
