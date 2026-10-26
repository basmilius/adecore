import type { ChatSendExtras } from '../../chat-client';
import { referenceTokens, type Referables } from '../../chat-references';
import { presentMentions, presentReferences, presentSkills } from '../../mentions';
import type { PromptDraft } from './use-prompt-menus';

/* What a prompt still holds of what was picked in it, as a send of the composer carries it. */
export function promptPicks(value: PromptDraft, referables: Referables): Pick<ChatSendExtras, 'mentions' | 'skills' | 'chats' | 'references'> {
    const text = value.text.trim();
    const tokens = referenceTokens([...value.chats, ...value.references], referables.items, value.referenceNames);

    return {
        mentions: presentMentions(text, value.mentions),
        skills: presentSkills(text, value.skills),
        chats: presentReferences(text, value.chats, tokens),
        // A machine that resolves only chats would drop the rest.
        references: referables.chatsOnly ? [] : presentReferences(text, value.references, tokens)
    };
}
