import type {
    ChatApprovalItem,
    ChatAssistantItem,
    ChatCheckpointDiff,
    ChatItem,
    ChatNoteMessage,
    ChatQuestionItem,
    ChatSubagentItem,
    ChatThinkingItem,
    ChatToolItem,
    ChatTurnItem,
    ChatUserItem,
    ChatVisual,
    ChatWorkflow,
    ModelSelection
} from '@adecore/agent-contracts';
import type { CommandLook, CommandLookSent, ThreadCard, ToolLook } from './host';

/* A look of the host's own: a program in a shell call, or an MCP server. */
export type Look = CommandLook | ToolLook;

/* A subagent's row: the work the thread kept of it, and the agents it opened in turn, each a row of its own under it. */
export interface SubagentBranch {
    id: string;
    item: ChatSubagentItem;
    children: ChatItem[];
    nested: SubagentBranch[];
    expanded: boolean;
}

/* The branch the turn started on was not the one it ended on, so its diff also holds what came in with the move. */
export interface BaseMoved {
    from: string;
    to: string;
}

/*
 * What the thread shows, row by row. Items are what the host knows; rows are what a reader
 * wants: one line per tool call, runs of tool calls folded into a summary, past turns folded
 * behind "Worked for 12s" and what the turn did, and the file changes of a turn gathered into one card.
 */
export type TimelineRow =
    | { kind: 'user'; id: string; item: ChatUserItem }
    | { kind: 'turn-start'; id: string; turn: ChatTurnItem; label: string }
    | { kind: 'assistant'; id: string; item: ChatAssistantItem }
    // A subagent's `SubagentHandback` call, drawn as the report it carries rather than as a tool call.
    | { kind: 'report'; id: string; text: string }
    | { kind: 'thinking'; id: string; item: ChatThinkingItem }
    | { kind: 'work'; id: string; tool: ChatToolItem }
    // `look` is set when every call is a run of that look and the summary is its sentence.
    | { kind: 'work-group'; id: string; tools: ChatToolItem[]; summary: string; expanded: boolean; look?: Look }
    | { kind: 'work-live'; id: string; tool: ChatToolItem }
    // The latest thought of a running turn, repeated over the call it led to; `at` is when that call began.
    | { kind: 'live-thought'; id: string; item: ChatThinkingItem; at: number }
    // A Workflow call the machine reports phases and agents for, drawn with them under it.
    | { kind: 'workflow'; id: string; tool: ChatToolItem; workflow: ChatWorkflow }
    | ({ kind: 'subagent' } & SubagentBranch)
    | { kind: 'approval'; id: string; item: ChatApprovalItem }
    | { kind: 'question'; id: string; item: ChatQuestionItem }
    | { kind: 'note'; id: string; level: 'info' | 'warning' | 'error'; text: string; from?: string; said?: true }
    // A message another node sent the chat, drawn as said to it under the name of its sender.
    | { kind: 'message'; id: string; message: ChatNoteMessage; createdAt: number }
    // A message this chat's agent sent another node with a command of a look, drawn as said instead of as its call.
    | { kind: 'sent'; id: string; tool: ChatToolItem; sent: CommandLookSent }
    | { kind: 'compaction'; id: string; preTokens: number | null }
    // The turn below ran on another model or effort than the turn before it.
    | { kind: 'selection-switch'; id: string; from: ModelSelection; to: ModelSelection }
    | {
          kind: 'changed-files';
          id: string;
          turnId: string;
          tools: ChatToolItem[];
          diff: ChatCheckpointDiff | null;
          checkpoint: boolean;
          baseMoved?: BaseMoved;
          // Set when `diff` holds back the diffs past its first few, which the host answers whole.
          heldBack?: boolean;
      }
    | { kind: 'turn-fold'; id: string; turn: ChatTurnItem; label: string; work: string[]; hiddenCount: number; expanded: boolean; expandable: boolean }
    | { kind: 'forks'; id: string; turnId: string }
    | { kind: 'working'; id: string; startedAt: number; tool?: ChatToolItem }
    // A card of the app's own (`thread-cards.ts`), never derived from an item.
    | { kind: 'app-card'; id: string; card: ThreadCard }
    // A page an agent published, placed by when it was published (`thread-cards.ts`), never derived from an item.
    | { kind: 'visual'; id: string; visual: ChatVisual };
