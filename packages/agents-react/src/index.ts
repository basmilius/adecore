// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
export {
    type ChatActions,
    type FileRef,
    type ShellCodeBlockContext,
    type ChatPlace,
    type SubagentTask,
    type TimelineFindOptions,
    type TimelineFind,
    type ComposerDictationProps,
    type ComposerHeaderSlotProps,
    type ComposerSlotProps,
    type ReferenceIconProps,
    type OutsideReference,
    type ComposerStatusDetail,
    type ComposerStatusItem,
    type SubagentSlotProps,
    type ThreadCard,
    type VisualHost,
    type HostMenuAction,
    type ReplyAuthor,
    type ChatHost,
    type UiMapSource,
    type UiModelViewProps,
    type CommandLook,
    type CommandLookCall,
    type CommandLookSent,
    type CommandLookMatch,
    type CommandName,
    type ToolLook,
    type ToolLookCall,
    type ToolLookMatch,
    ChatHostProvider,
    type AgentMark,
    type ChatHostLayer,
    useChatHost
} from './host/host';

export { type ChatScope, ChatScopeContext, useChatScope } from './scope';

export {
    type ChatRequestMap,
    type ChatEventMap,
    type ChatTransportStatus,
    type ChatTransport,
    ChatTransportError,
    errorCode,
    isConnectionError
} from './transport';

export { portTransport, type PortTransport } from './port-transport';
export { configureChatStorage } from './storage';
export { type MountedEntry, MountedRegistry } from './mounted-registry';
export { PROVIDERS_SECTION, USAGE_SECTION, settingsSection } from './settings/sections';
