import { CHAT_REQUEST_LIMITS, type ChatInfo } from '@adecore/agent-contracts';
import type { PromptSubject } from '../prompts/logic/subjects';
import type { PendingPrompt } from '../prompts/logic/prompts';
import type { ChatScope } from '../scope';
import { useChats, waitingRequestsOf } from '../state/chats';
import { subagentTitle } from './subagent-list';

type ChatPromptSubject = Extract<PromptSubject, { kind: 'chat' }>;

function stillWaiting(item: PendingPrompt, info: ChatInfo): boolean {
    return (
        info.status === 'needs-you' &&
        (info.requests === undefined ||
            info.requests.length >= CHAT_REQUEST_LIMITS.perChat ||
            info.requests.some((request) => request.requestId === item.requestId))
    );
}

/* Follows descendant requests while the main chat is open, including children discovered in later events or older history pages. */
export class ChatPromptFeed {
    private readonly scope: ChatScope;
    private readonly chatId: string;
    private readonly changed: (subjects: PromptSubject[]) => void;
    private readonly children = new Map<string, () => void>();
    private unsubscribe: (() => void) | undefined;
    private current: ChatPromptSubject[] | null = null;
    private disposed = false;

    constructor(scope: ChatScope, chatId: string, changed: (subjects: PromptSubject[]) => void) {
        this.scope = scope;
        this.chatId = chatId;
        this.changed = changed;
    }

    start(): void {
        this.unsubscribe = useChats.subscribe(() => this.update());
        this.update();
    }

    dispose(): void {
        this.disposed = true;
        this.unsubscribe?.();
        for (const release of this.children.values()) {
            release();
        }
        this.children.clear();
    }

    private update(): void {
        if (this.disposed) {
            return;
        }
        const store = useChats.getState();
        const subjects = new Map<string, ChatPromptSubject>();
        const seen = new Set<string>();
        const visit = (chatId: string, source?: ChatPromptSubject['source']): void => {
            if (seen.has(chatId)) {
                return;
            }
            seen.add(chatId);
            const key = this.scope.keyOf(chatId);
            const row = store.byKey[key];
            const info = store.statusByKey[key]?.info ?? row?.info;
            for (const item of waitingRequestsOf(row)) {
                if (info !== undefined && (chatId === this.chatId || stillWaiting(item, info))) {
                    subjects.set(`${chatId}:${item.requestId}`, { kind: 'chat', nodeId: chatId, item, ...(source === undefined ? {} : { source }) });
                }
            }
            for (const item of Object.values(row?.structure ?? {})) {
                if (item.kind !== 'subagent' || item.childId === undefined || seen.has(item.childId)) {
                    continue;
                }
                const childInfo = store.statusByKey[this.scope.keyOf(item.childId)]?.info;
                if (item.status !== 'running' && childInfo?.status !== 'needs-you') {
                    continue;
                }
                if (!this.children.has(item.childId)) {
                    this.children.set(item.childId, this.scope.chats.observe(item.childId));
                }
                visit(item.childId, { label: subagentTitle(item), provider: childInfo?.provider });
            }
        };
        visit(this.chatId);
        for (const [chatId, release] of this.children) {
            if (!seen.has(chatId)) {
                this.children.delete(chatId);
                release();
            }
        }
        const next = [...subjects.values()];
        if (
            this.current === null ||
            next.length !== this.current.length ||
            next.some((subject, index) => {
                const previous = this.current?.[index];
                return (
                    subject.nodeId !== previous?.nodeId ||
                    subject.item !== previous.item ||
                    subject.source?.label !== previous.source?.label ||
                    subject.source?.provider !== previous.source?.provider
                );
            })
        ) {
            this.current = next;
            this.changed(next);
        }
    }
}
