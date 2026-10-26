'use no memo';
/*
 * The React Compiler leaves a component that calls a hook read from a context as written, so the host's
 * hooks are called through these wrappers only. `ChatHostProvider` pins its host, so they never change.
 */
import type { ProviderPlatform } from '@adecore/agent-contracts';
import { referablesOfChats, type Referables } from './chat/chat-references';
import { useChatHost, type ChatHost, type CommandLook, type ComposerSendAction } from './host';

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

export function useHostStreaming(): ReturnType<ChatHost['useStreaming']> {
    return useChatHost().useStreaming();
}

export function useHostSendDelivery(): ReturnType<ChatHost['useSendDelivery']> {
    return useChatHost().useSendDelivery();
}

export function useHostTimelineFind(...args: Parameters<ChatHost['useTimelineFind']>): ReturnType<ChatHost['useTimelineFind']> {
    return useChatHost().useTimelineFind(...args);
}

export function useHostReferableChats(): ReturnType<ChatHost['useReferableChats']> {
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

const noPlatform = (): ProviderPlatform | null => null;

/* Null where the host does not say, as it need not. */
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

export function useHostHidesFolder(...args: Parameters<ChatHost['useHidesFolder']>): ReturnType<ChatHost['useHidesFolder']> {
    return useChatHost().useHidesFolder(...args);
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

const NO_SEND_ACTIONS: readonly ComposerSendAction[] = [];

const noSendActions = (): readonly ComposerSendAction[] => NO_SEND_ACTIONS;

export function useHostComposerSendActions(scopeId: string, chatId: string): readonly ComposerSendAction[] {
    const useSendActions = useChatHost().useComposerSendActions ?? noSendActions;

    return useSendActions(scopeId, chatId);
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
