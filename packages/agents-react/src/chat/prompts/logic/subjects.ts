import i18next from 'i18next';
import type { ChatHost } from '../../../host/host';
import type { PromptAction, PromptSubject } from '../../../host/prompts';
import { isBlockingPrompt } from './prompts';

/* The requests a chat's own prompts are answered with. */
export interface ChatPromptClients {
    approve(chatId: string, requestId: string, decision: 'allow' | 'allow-always' | 'deny', message?: string): Promise<void>;
    answer(chatId: string, requestId: string, answers: Record<string, string>): Promise<void>;
    dismiss(chatId: string, itemId: string): Promise<void>;
}

export interface ApprovalButtonSpec {
    id: string;
    label: string;
    description?: string;
    primary: boolean;
    /* Grants beyond this one request, so the keyboard never starts on it. */
    lasting?: boolean;
    action: PromptAction;
}

/* Unique across the chats of a view and the app's own prompts, and stable while the prompt waits. */
export function promptIdOf(subject: PromptSubject): string {
    return subject.kind === 'chat' ? `agent-chat:${subject.nodeId}:${subject.item.requestId}` : subject.prompt.id;
}

export function promptCreatedAt(subject: PromptSubject): number {
    return subject.kind === 'chat' ? subject.item.createdAt : subject.prompt.createdAt;
}

/* Only a chat's optional question does not hold anything up; the app says so of its own. */
export function isBlockingSubject(subject: PromptSubject): boolean {
    return subject.kind === 'chat' ? isBlockingPrompt(subject.item) : subject.prompt.blocking;
}

/* The buttons of a chat's permission request in the order it draws them: a remembered rule, Deny, then Allow as the primary. */
export function approvalButtons(subject: PromptSubject, reason: string): ApprovalButtonSpec[] {
    if (subject.kind !== 'chat' || subject.item.kind !== 'approval') {
        return [];
    }

    const { item } = subject;
    const message = reason.trim();

    return [
        ...(item.canAllowAlways && item.allowAlways
            ? [
                  {
                      id: 'allow-always',
                      label: item.allowAlways.label,
                      description: item.allowAlways.description,
                      primary: false,
                      lasting: true,
                      action: { kind: 'approve', decision: 'allow-always' } as const
                  }
              ]
            : []),
        {
            id: 'deny',
            label: i18next.t('agent-prompts:approval.deny'),
            primary: false,
            action: { kind: 'approve', decision: 'deny', ...(message ? { message } : {}) }
        },
        { id: 'allow', label: i18next.t('agent-prompts:approval.allow'), primary: true, action: { kind: 'approve', decision: 'allow' } }
    ];
}

/*
 * Sends a card's action as the request its subject is answered with, or to `host` for a prompt it raised.
 * A refusal comes back as an error for the card to show.
 */
export async function answerPrompt(
    subject: PromptSubject,
    action: PromptAction,
    chat: ChatPromptClients | null,
    host: Pick<ChatHost, 'prompts'>
): Promise<void> {
    if (subject.kind === 'host') {
        return host.prompts.answer(subject.prompt, action);
    }

    if (chat === null) {
        throw new Error(i18next.t('agent-prompts:error.notConnected'));
    }

    const { item, nodeId } = subject;

    if (action.kind === 'approve') {
        return chat.approve(nodeId, item.requestId, action.decision, action.message);
    }

    if (action.kind === 'answer') {
        return chat.answer(nodeId, item.requestId, action.answers);
    }

    if (action.kind === 'dismiss') {
        return chat.dismiss(nodeId, item.id);
    }

    throw new Error(i18next.t('agent-prompts:error.noChoices'));
}
