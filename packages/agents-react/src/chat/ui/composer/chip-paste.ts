import type { EditorView } from '@codemirror/view';
import type { ChatDraft } from '../../drafts';
import type { Referable } from '../../chat-references';
import {
    chipRanges,
    clipboardChipsOf,
    hasClipboardChips,
    namedReferenceRanges,
    tokenizeChips,
    writeClipboardChips,
    type ClipboardChips,
    type ReferenceToken,
    type TextRange
} from '../../mentions';
import { codeRanges } from './editor';

/* What a composer knows of the chips a paste may make: the skills there are and what `#` points at. */
export interface PasteChoices {
    skills: readonly string[];
    referables: readonly Referable[];
    /* Ids the draft already points at, which win over another of the same name. */
    referenced: readonly string[];
    /* False for a CLI that does not read `@path`, which gets the text as it is. */
    mentions: boolean;
}

/*
 * The chips a plain paste spells between `from` and `to` of the text it landed in: `$name` for a skill
 * there is, `#Name` by the reply rule. Code spans and code blocks keep what they hold.
 */
export function pastedChipsIn(text: string, from: number, to: number, code: readonly TextRange[], choices: PasteChoices): ClipboardChips {
    const outside = [...code, { from: 0, to: from }, { from: to, to: text.length }];
    const skills = chipRanges(text, [], [...choices.skills], outside);
    const references = namedReferenceRanges(text, choices.referables, choices.referenced, outside);
    return clipboardChipsOf(
        text.slice(from, to),
        [...skills, ...references].map((range) =>
            range.kind === 'skill' ? { kind: 'skill', name: range.value } : { kind: 'reference', id: range.value, name: text.slice(range.from + 1, range.to) }
        )
    );
}

/* Whether a plain paste could make a chip at all, before it goes in as text. */
export function mayHoldChips(text: string): boolean {
    return /(^|[\s([{"'“‘])[$#]\p{L}/u.test(text);
}

/* The draft with the chips of a paste added, a chat beside the views and nodes as the picker keeps it. */
export function withPastedChips(draft: ChatDraft, chips: ClipboardChips, choices: PasteChoices): ChatDraft {
    const add = (ids: readonly string[], more: readonly string[]): string[] => [
        ...ids,
        ...more.filter((id, index) => !ids.includes(id) && more.indexOf(id) === index)
    ];
    const isChat = (token: ReferenceToken): boolean => choices.referables.some((item) => item.id === token.id && item.kind === 'chat');
    const chats = chips.references.filter(isChat);
    const references = chips.references.filter((token) => !isChat(token));
    return {
        ...draft,
        mentions: choices.mentions ? add(draft.mentions, chips.mentions) : draft.mentions,
        skills: add(draft.skills, chips.skills),
        chats: add(
            draft.chats,
            chats.map((token) => token.id)
        ),
        references: add(
            draft.references,
            references.map((token) => token.id)
        ),
        referenceNames:
            chips.references.length === 0
                ? draft.referenceNames
                : { ...draft.referenceNames, ...Object.fromEntries(chips.references.map((token) => [token.id, token.name])) }
    };
}

/*
 * Puts a paste in the editor and says which chips it brings: the ones it was copied with, or the ones
 * its plain text spells. Null when there are none, so the editor pastes it as it always does.
 */
export function pasteWithChips(view: EditorView, clip: string, copied: ClipboardChips | null, choices: PasteChoices): ClipboardChips | null {
    if (copied !== null && hasClipboardChips(copied)) {
        view.dispatch(view.state.replaceSelection(copied.text), { scrollIntoView: true, userEvent: 'input.paste' });
        return copied;
    }
    if (!mayHoldChips(clip)) {
        return null;
    }
    const from = view.state.selection.main.from;
    const inserted = view.state.replaceSelection(clip);
    const state = view.state.update(inserted).state;
    const to = state.selection.main.head;
    const found = pastedChipsIn(state.doc.toString(), from, to, codeRanges(state), choices);
    if (!hasClipboardChips(found)) {
        return null;
    }
    view.dispatch(inserted, { scrollIntoView: true, userEvent: 'input.paste' });
    return found;
}

/* A copy or a cut of a selection that holds chips, which carries them beside its text. False leaves it to the editor. */
export function copyWithChipsFromEditor(
    event: ClipboardEvent,
    view: EditorView,
    draft: Pick<ChatDraft, 'mentions' | 'skills'>,
    references: readonly ReferenceToken[]
): boolean {
    const { from, to } = view.state.selection.main;
    if (from === to || event.clipboardData === null) {
        return false;
    }
    const text = view.state.sliceDoc(from, to);
    const chips = clipboardChipsOf(text, tokenizeChips(text, draft.mentions, draft.skills, references));
    if (!hasClipboardChips(chips)) {
        return false;
    }
    writeClipboardChips(event.clipboardData, chips);
    event.preventDefault();
    if (event.type === 'cut') {
        view.dispatch({ changes: { from, to }, scrollIntoView: true, userEvent: 'delete.cut' });
    }
    return true;
}
