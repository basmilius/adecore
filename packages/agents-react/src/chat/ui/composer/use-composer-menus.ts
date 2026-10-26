import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatInfo, ChatSkill, ProviderCapabilities } from '@adecore/agent-contracts';
import { useChatScope } from '../../../scope';
import type { ComposerInputHandle } from '../ComposerInput';
import type { ComposerDraft } from './use-composer-draft';
import { usePromptMenus, type PromptMenus } from './use-prompt-menus';
import { useHostReferables } from '../../../host-hooks';

export type { ComposerCommand } from './use-prompt-menus';

// Commands the composer handles itself; the CLI's own ones are sent through as text.
export const LOCAL_COMMANDS = ['model', 'compact', 'clear'];

interface MenusInput {
    chatId: string;
    info: ChatInfo;
    capabilities: ProviderCapabilities | undefined;
    providerName: string | undefined;
    draft: ComposerDraft;
    inputRef: RefObject<ComposerInputHandle | null>;
}

/* The pickers over a chat's composer, fed by what the chat's CLI has: its skills, its commands and its folder. */
export function useComposerMenus({ chatId, info, capabilities, providerName, draft, inputRef }: MenusInput): PromptMenus {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const referables = useHostReferables(scope.id, chatId);
    const [skills, setSkills] = useState<ChatSkill[]>([]);

    /*
     * The host's skill list, once per chat, again once the CLI announced its own after the first message,
     * and again when its process comes or goes, which is when a restart reads new skills.
     */
    useEffect(() => {
        let stale = false;
        scope.chats
            .listSkills(chatId)
            .then((found) => {
                if (!stale) {
                    setSkills(found);
                }
            })
            .catch(() => undefined);
        return () => {
            stale = true;
        };
    }, [scope, chatId, info.skills, info.running]);

    return usePromptMenus({
        draft,
        inputRef,
        // A CLI that does not expand `@path` gets the text as it is, so the picker stays out of the way.
        cwd: capabilities?.mentions === false ? null : info.cwd,
        skills,
        slashCommands: info.slashCommands,
        localCommands: LOCAL_COMMANDS,
        goals: capabilities?.goals !== undefined,
        providerName,
        referables,
        ownId: chatId,
        label: t('composer.inputLabel')
    });
}

export type ComposerMenus = PromptMenus;
