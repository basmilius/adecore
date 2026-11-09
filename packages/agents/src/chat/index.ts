// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
export { type AcpClientInfo } from '../backends/acp-backend.ts';
// The file a tool call edits, parsed once for the thread, an approval and a daemon's provenance.
export { toolFileEdit, type ToolFileEdit, type ToolFileEditPiece } from '@adecore/agent-contracts';

export type { ApiHostTools } from './api-chat.ts';
export type { ApiToolDefinition } from './api-tools.ts';
export { AttachmentStore } from './attachment-store.ts';
export type { BackendChange, BackendLaunch, ChatMcpServer, TurnInput, ApprovalDecision, BackendEvent, BackendHost, ChatBackend } from '../backends/backend.ts';
export { runningInBackground } from './background-work.ts';
export { BookmarkStore } from './bookmark-store.ts';
export { createChatCompletionsBackend, type ChatCompletionsUsage } from './chat-completions-backend.ts';
export { type InterruptedRun, type ChatCoreOptions, ChatCore } from './chat-core.ts';
export { COMPACT_ABOVE_BYTES } from './chat-log.ts';

export { type ChatSpawnOptions, type SpawnChatProcess, spawnChatProcess, MAX_LINE_LENGTH, ChatChild } from '../chat-process.ts';

export { type PromptNotes, type ChatReferences, type ResumeWords, ChatSession, type ChatSendExtras } from './chat-session.ts';

export type { ChatSidecar, ForkKept } from './chat-sidecar.ts';
export { type ChatRecordExtras, type ChatRecord, ChatStore } from './chat-store.ts';
export { buildTitlePrompt, parseTitle, suggestChatTitle, type ChatTitleInput } from './chat-title.ts';
export { ClaudeTitleReader } from './claude-title.ts';
export { claudeProjectSlug, findClaudeSession } from './claude-transcript.ts';
export type { CodexClientInfo } from '../backends/codex-transport.ts';
export type { ComposerPreference } from './composer-preferences.ts';
export { type ChatErrorCode, ChatError } from '../chat-error.ts';
export { type SessionFs, type ExternalSession, listClaudeSessions, listCodexSessions, nodeSessionFs } from './external-sessions.ts';
export { limitedTurn, limitResumeAt } from './limit-resume.ts';
export { readableAssistantText } from '../readable-text.ts';
export { searchThreadItems } from './thread-search.ts';
export { ChatThread } from './thread.ts';
export { type ChatUiSource, type ChatUiHost, ChatUiRefusal } from './ui-queries.ts';
export { visualFileName, VisualStore } from './visual-store.ts';
export { type WakeChat, chatOpener } from './wake-chat.ts';
