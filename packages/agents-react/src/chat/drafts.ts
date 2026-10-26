import { chatStorageKey, chatStorageLegacyKeys, createChatStore } from '../storage';
import type { ChatAttachmentUpload } from '@adecore/agent-contracts';
import { checkAttachmentLimits, uploadBytes } from './attachments';
import { persistedJson } from './persisted-json';

const storageKey = (): string => chatStorageKey('drafts');

export interface ChatDraft {
    text: string;
    mentions: string[];
    skills: string[];
    /* Chats of the project picked with `#`, by id; apart from `references`, since every machine takes a chat. */
    chats: string[];
    attachments: ChatAttachmentUpload[];
    /* A piece of an answer that goes above the text as a blockquote; empty for none. */
    quote: string;
    /* The reply the quote was taken from; null when the quote names none. */
    quoteSource: string | null;
    /* Views and nodes of the project picked with `#`, by id. */
    references: string[];
    /* The name each pick was spelled with in the text, by id, so a chip outlives a rename; a pick without one takes the name it has now. */
    referenceNames?: Record<string, string>;
}

export const EMPTY_DRAFT: ChatDraft = { text: '', mentions: [], skills: [], chats: [], attachments: [], quote: '', quoteSource: null, references: [] };

// Older records only had text; the rest is filled in on read.
type DraftRecord = {
    text: string;
    mentions?: string[];
    skills?: string[];
    chats?: string[];
    attachments?: ChatAttachmentUpload[];
    quote?: string;
    quoteSource?: string;
    references?: string[];
    referenceNames?: Record<string, string>;
};

const storage = persistedJson<Record<string, DraftRecord>>(
    storageKey,
    (raw) => (raw ? (JSON.parse(raw) as Record<string, DraftRecord>) : {}),
    {},
    () => chatStorageLegacyKeys('drafts')
);

export function isEmptyDraft(draft: ChatDraft): boolean {
    return draft.text.trim() === '' && draft.attachments.length === 0 && draft.quote === '';
}

/*
 * Which chats hold an unsent prompt, for a dot beside them in a list of chats. The drafts themselves
 * stay in storage: a node that is not on screen has no composer, and this is all anyone else needs.
 */
export const useDrafts = createChatStore<{ ids: string[] }>(
    () => ({ ids: [] }),
    (store) => store.setState({ ids: Object.keys(storage.read()) })
);

function trackDraft(chatId: string, held: boolean): void {
    const { ids } = useDrafts.getState();

    if (ids.includes(chatId) === held) {
        return;
    }

    useDrafts.setState({ ids: held ? [...ids, chatId] : ids.filter((id) => id !== chatId) });
}

/* An unsent prompt per chat node, kept across reloads so a half-written message is never lost. */
export function readDraft(chatId: string): ChatDraft {
    const record = storage.read()[chatId];

    return record
        ? {
              text: record.text,
              mentions: record.mentions ?? [],
              skills: record.skills ?? [],
              chats: record.chats ?? [],
              attachments: record.attachments ?? [],
              quote: record.quote ?? '',
              quoteSource: record.quoteSource ?? null,
              references: record.references ?? [],
              ...(record.referenceNames === undefined ? {} : { referenceNames: record.referenceNames })
          }
        : EMPTY_DRAFT;
}

export function writeDraft(chatId: string, draft: ChatDraft): void {
    const drafts = storage.read();
    trackDraft(chatId, !isEmptyDraft(draft));

    if (isEmptyDraft(draft)) {
        delete drafts[chatId];
        storage.write(drafts);

        return;
    }

    drafts[chatId] = recordOf(draft, true);

    if (storage.write(drafts)) {
        return;
    }

    // A file can outgrow the storage quota; the text is the part worth keeping then.
    drafts[chatId] = recordOf(draft, false);
    storage.write(drafts);
}

function recordOf(draft: ChatDraft, withFiles: boolean): DraftRecord {
    return {
        text: draft.text,
        mentions: draft.mentions,
        skills: draft.skills,
        chats: draft.chats,
        ...(withFiles ? { attachments: draft.attachments } : {}),
        quote: draft.quote,
        ...(draft.quoteSource === null ? {} : { quoteSource: draft.quoteSource }),
        references: draft.references,
        ...namesOf(draft)
    };
}

function namesOf(draft: ChatDraft): Pick<DraftRecord, 'referenceNames'> {
    return draft.referenceNames === undefined ? {} : { referenceNames: draft.referenceNames };
}

/* Text handed to a draft from outside the composer goes under what was already typed, never over it. */
export function joinDraftText(current: string, added: string): string {
    return current.trim() === '' ? added : `${current.replace(/\s+$/, '')}\n\n${added}`;
}

function union(first: readonly string[], second: readonly string[]): string[] {
    return [...first, ...second.filter((entry) => !first.includes(entry))];
}

/*
 * A queued message taken back to edit goes above what was typed since. Its files join the draft's as
 * far as the limits let them, and the rest come back rejected, the way a dropped file would. A quote
 * it was sent with is part of its text; the draft keeps the one it holds.
 */
export function takeBackIntoDraft(
    current: ChatDraft,
    taken: Omit<ChatDraft, 'quote' | 'quoteSource'>
): { draft: ChatDraft; rejected: Array<{ name: string; reason: string }> } {
    const checked = checkAttachmentLimits(
        current.attachments.length,
        taken.attachments.map((upload) => ({ name: upload.name, mime: upload.mime, bytes: uploadBytes(upload), upload })),
        current.attachments.reduce((bytes, upload) => bytes + uploadBytes(upload), 0)
    );

    return {
        draft: {
            text: current.text.trim() === '' ? taken.text : joinDraftText(taken.text, current.text),
            mentions: union(taken.mentions, current.mentions),
            skills: union(taken.skills, current.skills),
            chats: union(taken.chats, current.chats),
            attachments: [...checked.accepted.map((entry) => entry.upload), ...current.attachments],
            quote: current.quote,
            quoteSource: current.quoteSource,
            references: union(taken.references, current.references),
            ...namesOf(current)
        },
        rejected: checked.rejected
    };
}

type DraftTaker = (text: string) => void;

/* The composers on screen, by chat. One that is not mounted reads what was offered from storage when it is. */
const takers = new Map<string, DraftTaker>();

export function takeDraftOffers(chatId: string, take: DraftTaker): () => void {
    takers.set(chatId, take);

    return () => {
        if (takers.get(chatId) === take) {
            takers.delete(chatId);
        }
    };
}

/*
 * Puts text in a chat's prompt without sending it: the person reads it and presses Enter. A mounted
 * composer owns its draft and writes it back to storage itself, so it has to be the one to take it.
 */
export function offerDraft(chatId: string, text: string): void {
    const take = takers.get(chatId);

    if (take) {
        take(text);

        return;
    }

    const current = readDraft(chatId);
    writeDraft(chatId, { ...current, text: joinDraftText(current.text, text) });
}
