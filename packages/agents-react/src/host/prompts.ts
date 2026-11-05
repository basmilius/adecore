import type { AgentKind, ChatApprovalItem, ChatQuestionItem } from '@adecore/agent-contracts';
import type { ReactNode } from 'react';

export type PendingPrompt = ChatApprovalItem | ChatQuestionItem;

export type PromptAction =
    | { kind: 'approve'; decision: 'allow' | 'allow-always' | 'deny'; message?: string }
    | { kind: 'answer'; answers: Record<string, string> }
    | { kind: 'dismiss' }
    // A terminal's permission request, answered with one of the choices the host offered.
    | { kind: 'choose'; choiceId: string };

export interface PromptAnswer {
    choices: string[];
    text: string;
    custom: boolean;
}

export interface PromptDraft {
    index: number;
    answers: Record<string, PromptAnswer>;
    reason: string;
    showReason: boolean;
}

/*
 * A prompt the app raises beside a chat's own requests, such as its own approval to operate
 * something. The app draws it and answers it (`ChatHost.prompts`); the chat only orders it among the
 * rest and keeps its draft.
 */
export interface HostPrompt {
    /* Unique across the prompts of a view, and stable while the prompt waits. */
    id: string;
    createdAt: number;
    blocking: boolean;
    /* The mark a pointer to it wears: a hand for a request, a question mark for anything else. */
    asks: 'approval' | 'question';
    /* What the app knows about it, for its own drawing and answering; the same object while nothing about it changed. */
    data: unknown;
}

/* What a prompt card draws, whatever asked it. The chat's items pass through unchanged. */
export type PromptSubject =
    | { kind: 'chat'; nodeId: string; item: PendingPrompt; source?: { label: string; provider?: AgentKind } }
    | { kind: 'host'; nodeId: string; prompt: HostPrompt };

/* What a card is given to draw, the chat's and the app's alike. */
export interface PromptViewProps {
    subject: PromptSubject;
    draft: PromptDraft;
    onDraft(draft: PromptDraft): void;
    onAction(action: PromptAction): void;
    more: number;
    hasDraft: boolean;
    denyReason: boolean;
    disabled: boolean;
    sending: boolean;
    error: string | null;
    top?: ReactNode;
    /* Takes the person to whatever an app's own card is about. */
    onReveal?: () => void;
}
