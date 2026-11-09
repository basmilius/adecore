// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
export { type AccountChoice, useAccountChoice, useNewAccountChoice } from './account-choice';
export { actionsOf, useChatActions } from './actions';
export { type ChatSendExtras, ChatClient } from '../chat-client';
export type { ProjectChat, Referable, ReferableKind, Referables } from '../host/references';
export { REFERENCE_ICONS } from './ui/reference-icons';
export { sendFromComposer } from './composer-send';
export { stepEffortFromComposer } from './composer-effort';
export { EMPTY_DRAFT, useDrafts, readDraft, writeDraft, offerDraft } from './drafts';
export { stripAnsi } from './logic/ansi';

export {
    canForkWith,
    forkRefusal,
    summaryRefusal,
    lastSettledTurn,
    forkPointOf,
    forkPointLabel,
    type ForkShape,
    forkShapes,
    type ForkCliChoice,
    forkPayload,
    branchRefusal
} from './logic/fork';

export { matchCommandLook, lookRunOf, sentMessageOf } from './logic/command-looks';
export { type Look } from '../host/timeline-row';
export { mcpCallOf } from './logic/tool-looks';
export { handbackReportOf } from './logic/handback';
export { limitView } from './logic/limit';
export { summarizeGroup, deriveTimelineRows } from './logic/timeline';
export { type TimelineRow, type SubagentBranch } from '../host/timeline-row';
export { toolSummary, type FileChange } from './logic/tools';

export {
    workflowPhases,
    workflowCounts,
    workflowAgentState,
    workflowAgentTime,
    workflowAgentPreview,
    workflowDescription,
    workflowPhaseState,
    workflowPhaseTime,
    liveWorkflowPhase,
    type WorkflowPhaseView,
    type WorkflowAgentView,
    type WorkflowAgentState,
    type WorkflowAgentPreview,
    type WorkflowCounts,
    type WorkflowPhaseStateKind
} from './logic/workflow';

export { MENTION_DRAG_TYPE, LEGACY_MENTION_DRAG_TYPE, carriesMentions, droppedMentions, writeMentionDrag, chipText } from './mentions';

export {
    defaultProvider,
    selectionFor,
    startingSelection,
    accountFor,
    chatPreferencesPayload,
    useChatPreferences,
    readChatPreferences,
    CHAT_PREFERENCES_KEY,
    reloadChatPreferences,
    rememberChatPreferences,
    rememberReadingWidth,
    rememberSendKey,
    rememberChatSelection,
    type ChatPreferences
} from './preferences';

export { CHAT_READING_WIDTHS, readingWidthLabel, readingWidthHint } from './reading-width';
export { recentChatMessages, recentSubagentMessages } from './recent-messages';
export { RUNTIME_MODES, runtimeModeLabel, runtimeModeHint } from './runtime-modes';
export { CHAT_SEND_KEYS, SEND_AND_NEW_SHORTCUT, sendKeyLabel, sendKeyHint } from './send-key';
export { subagentTitle, summaryWordOf, stopOf, type SubagentStop } from './subagent-list';
export { waitingOnOf, waitingOnLabel, type WaitingChild, type WaitingOn, type WaitingOnInput } from './waiting-on';
export { useSubagentSupport } from './subagent-support';

export {
    crumbOf,
    openFromMain,
    composerWrites,
    canOpenSubagent,
    useSubagentView,
    useSubagentTrail,
    useSubagentItem,
    type SubagentStep,
    type SubagentTrail
} from './subagent-view';

export { stepTimelineMessage, jumpToTimelineItem, type TurnTarget, registerTurnJumper, jumpToTimelineTurn } from './timeline-scroll';
export { type StatusWord, statusLookOf, taskStatusWord } from '../agents/status-look';

export { ChatPromptFeed } from './pending-prompts';
