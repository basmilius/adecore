// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
export { type AcpAgentSpec, type AcpClientInfo, type AcpUsageReport, createAcpBackend } from '../backends/acp-backend.ts';
// What a chat is doing, for every host question about it being busy; the predicate lives in the contracts so a client reads it too.
export { chatActivity, type ChatActivity } from '@adecore/agent-contracts';
// The file a tool call edits, parsed once for the thread, an approval and a daemon's provenance.
export { toolFileEdit, type ToolFileEdit, type ToolFileEditPiece } from '@adecore/agent-contracts';

export type {
    AcpAgentInfo,
    AcpModel,
    AcpModelState,
    AcpMode,
    AcpModeState,
    AcpPermissionRequest,
    AcpSessionInfo,
    AcpModeMap,
    AcpChoice,
    AcpThoughtLevel,
    AcpTurnUsage
} from '../backends/acp-protocol.ts';

export type { ApiHostTools, ApiToolOutcome, ToolRounds } from './api-chat.ts';
export type { ApiToolDefinition } from './api-tools.ts';
export { AttachmentStore } from './attachment-store.ts';
export type { BackendChange, BackendLaunch, ChatMcpServer, TurnInput, ApprovalDecision, BackendEvent, BackendHost, ChatBackend } from '../backends/backend.ts';
export { runningInBackground, type BackgroundWork } from './background-work.ts';
export { BookmarkStore, type BookmarkListener } from './bookmark-store.ts';
export { createChatCompletionsBackend, type ChatCompletionsSpec, type ChatCompletionsUsage, type ChatCompletionsWords } from './chat-completions-backend.ts';
export type { ChatCompletionsTokens } from './chat-completions-stream.ts';
export { type InterruptedRun, type ChatCoreHooks, type ChatCoreOptions, ChatCore } from './chat-core.ts';
export { COMPACT_ABOVE_BYTES, type ChatLogLine } from './chat-log.ts';

export {
    type ChatSpawnOptions,
    type SpawnChatProcess,
    spawnChatProcess,
    MAX_LINE_LENGTH,
    LineSplitter,
    ChatChild,
    type ChatProcess,
    type ChatChildOptions
} from '../chat-process.ts';

export {
    type PromptNotes,
    type ChatReferences,
    type ResumeWords,
    ChatSession,
    type TurnCheckpoints,
    type ChatSessionOptions,
    type LimitResumeHooks,
    type ChatSendExtras,
    type ResumeDecision
} from './chat-session.ts';

export type { ChatSidecar, ForkKept } from './chat-sidecar.ts';
export { type ChatRecordExtras, type ChatRecord, ChatStore, type ChatSeq, type ChatStoreOptions } from './chat-store.ts';
export { buildTitlePrompt, parseTitle, suggestChatTitle, type ChatTitleInput } from './chat-title.ts';
export type { ClaudeApiKeyOptions, ClaudeBackendOptions } from '../backends/claude-backend.ts';
export { ClaudeTitleReader } from './claude-title.ts';
export { claudeProjectSlug, findClaudeSession } from './claude-transcript.ts';
export type { CodexBackendOptions } from '../backends/codex-backend.ts';
export type { ProviderThreads, ThreadItemsParams, ThreadProcess, ThreadForkParams } from '../backends/threads.ts';
export type { CodexClientInfo } from '../backends/codex-transport.ts';
export type { ComposerPreference } from './composer-preferences.ts';
export { type ChatErrorCode, ChatError } from '../chat-error.ts';
export { type SessionFs, type ExternalSession, listClaudeSessions, listCodexSessions, nodeSessionFs } from './external-sessions.ts';
export { limitedTurn, limitResumeAt } from './limit-resume.ts';
export { readableAssistantText } from '../readable-text.ts';
export type { SubagentChat, SubagentReaderOptions } from './subagent-reader.ts';
export type { SubagentSettlement } from './subagent-settlement.ts';
export { searchThreadItems, type ThreadHit, type ThreadSearchOptions } from './thread-search.ts';
export { ChatThread } from './thread.ts';
export { type ChatUiSource, type ChatUiHost, ChatUiRefusal } from './ui-queries.ts';
export { visualFileName, VisualStore, type VisualInput, type VisualStoreOptions, type VisualListener } from './visual-store.ts';
export { type WakeChat, chatOpener, type ChatOpenerDeps } from './wake-chat.ts';
export { type SkillRootOptions } from '../skills.ts';
