'use no memo';
/*
 * The React Compiler leaves a component that calls a hook read from a context as written, so the host's
 * hooks are called through these wrappers only. `ChatHostProvider` pins its host, so they never change.
 */
import type { ProviderPlatform } from '@adecore/agent-contracts';
import type { AccountRule } from './host';
import { useChatHost, type ChatHost, type CommandLook, type ComposerStatusItem, type UnknownItemWords } from './host';
import { referablesOfChats, type Referables } from './references';

export function useHostCodeMode(): 'light' | 'dark' {
    return useChatHost().code.useMode();
}

export function useHostCodeThemes(): { light: string; dark: string } {
    return useChatHost().code.useThemes();
}

export function useHostAttachmentUrl(...args: Parameters<ChatHost['attachments']['useUrl']>): ReturnType<ChatHost['attachments']['useUrl']> {
    return useChatHost().attachments.useUrl(...args);
}

export function useHostTasks(...args: Parameters<ChatHost['tasks']['useTasks']>): ReturnType<ChatHost['tasks']['useTasks']> {
    return useChatHost().tasks.useTasks(...args);
}

export function useHostTask(...args: Parameters<ChatHost['tasks']['useTask']>): ReturnType<ChatHost['tasks']['useTask']> {
    return useChatHost().tasks.useTask(...args);
}

export function useHostExtraPrompts(...args: Parameters<ChatHost['prompts']['useExtra']>): ReturnType<ChatHost['prompts']['useExtra']> {
    return useChatHost().prompts.useExtra(...args);
}

const useNoUnknownItemWords = (): UnknownItemWords | null => null;

export function useHostUnknownItemWords(): UnknownItemWords | null {
    const useWords = useChatHost().useUnknownItemWords ?? useNoUnknownItemWords;

    return useWords();
}

export function useHostStreaming(): ReturnType<ChatHost['useStreaming']> {
    return useChatHost().useStreaming();
}

export function useHostSendDelivery(): ReturnType<ChatHost['useSendDelivery']> {
    return useChatHost().useSendDelivery();
}

export function useHostHidesToolCalls(...args: Parameters<ChatHost['useHidesToolCalls']>): ReturnType<ChatHost['useHidesToolCalls']> {
    return useChatHost().useHidesToolCalls(...args);
}

export function useHostTimelineFind(...args: Parameters<ChatHost['useTimelineFind']>): ReturnType<ChatHost['useTimelineFind']> {
    return useChatHost().useTimelineFind(...args);
}

function useHostReferableChats(): ReturnType<ChatHost['useReferableChats']> {
    return useChatHost().useReferableChats();
}

const useReferablesFromChats = (_scopeId: string, _chatId: string): Referables => referablesOfChats(useHostReferableChats());

/* A host without views of its own offers its chats. */
export function useHostReferables(scopeId: string, chatId: string): Referables {
    const useReferables = useChatHost().useReferables ?? useReferablesFromChats;

    return useReferables(scopeId, chatId);
}

export function useHostLoginBlocked(...args: Parameters<ChatHost['useLoginBlocked']>): ReturnType<ChatHost['useLoginBlocked']> {
    return useChatHost().useLoginBlocked(...args);
}

const NO_EXPANDING: ReturnType<NonNullable<ChatHost['useExpandingCommands']>> = [];
const noExpanding = (): ReturnType<NonNullable<ChatHost['useExpandingCommands']>> => NO_EXPANDING;

export function useHostExpandingCommands(): ReturnType<NonNullable<ChatHost['useExpandingCommands']>> {
    const useExpanding = useChatHost().useExpandingCommands ?? noExpanding;

    return useExpanding();
}

const noPlatform = (): ProviderPlatform | null => null;

export function useHostMachinePlatform(scopeId: string): ProviderPlatform | null {
    const useMachinePlatform = useChatHost().useMachinePlatform ?? noPlatform;

    return useMachinePlatform(scopeId);
}

export function useHostProjectLook(...args: Parameters<ChatHost['useProjectLook']>): ReturnType<ChatHost['useProjectLook']> {
    return useChatHost().useProjectLook(...args);
}

export function useHostMachineLabel(...args: Parameters<ChatHost['useMachineLabel']>): ReturnType<ChatHost['useMachineLabel']> {
    return useChatHost().useMachineLabel(...args);
}

export function useHostChatPlace(...args: Parameters<ChatHost['useChatPlace']>): ReturnType<ChatHost['useChatPlace']> {
    return useChatHost().useChatPlace(...args);
}

export function useHostContextSources(...args: Parameters<ChatHost['useContextSources']>): ReturnType<ChatHost['useContextSources']> {
    return useChatHost().useContextSources(...args);
}

export function useHostWelcome(...args: Parameters<ChatHost['useWelcome']>): ReturnType<ChatHost['useWelcome']> {
    return useChatHost().useWelcome(...args);
}

export function useHostResumeAtReset(...args: Parameters<ChatHost['useResumeAtReset']>): ReturnType<ChatHost['useResumeAtReset']> {
    return useChatHost().useResumeAtReset(...args);
}

export function useHostComposerPlaceholder(...args: Parameters<ChatHost['useComposerPlaceholder']>): ReturnType<ChatHost['useComposerPlaceholder']> {
    return useChatHost().useComposerPlaceholder(...args);
}

const NO_STATUS: readonly ComposerStatusItem[] = [];

const noStatus = (): readonly ComposerStatusItem[] => NO_STATUS;

export function useHostComposerStatus(scopeId: string, chatId: string): readonly ComposerStatusItem[] {
    const useStatus = useChatHost().useComposerStatus ?? noStatus;

    return useStatus(scopeId, chatId);
}

export function useHostThreadCards(...args: Parameters<ChatHost['useThreadCards']>): ReturnType<ChatHost['useThreadCards']> {
    return useChatHost().useThreadCards(...args);
}

export function useHostReplyAuthor(...args: Parameters<ChatHost['useReplyAuthor']>): ReturnType<ChatHost['useReplyAuthor']> {
    return useChatHost().useReplyAuthor(...args);
}

export function useHostMapSource(maps: NonNullable<ChatHost['maps']>, scopeId: string): ReturnType<NonNullable<ChatHost['maps']>['useSource']> {
    return maps.useSource(scopeId);
}

export function useCommandNames(
    look: Required<Pick<CommandLook, 'useNames'>>,
    scopeId: string,
    chatId: string
): ReturnType<NonNullable<CommandLook['useNames']>> {
    return look.useNames(scopeId, chatId);
}

export function useHostCanReorderAccounts(scopeId: string): boolean {
    const useCanReorder = useChatHost().useCanReorderAccounts ?? (() => true);

    return useCanReorder(scopeId);
}

export function useHostCanShareAccountConfig(scopeId: string): boolean {
    const useCanShare = useChatHost().useCanShareAccountConfig ?? (() => false);

    return useCanShare(scopeId);
}

export function useHostAccountRule(scopeId: string, chatId: string): AccountRule | null {
    const useRule = useChatHost().useAccountRule ?? (() => null);

    return useRule(scopeId, chatId);
}
