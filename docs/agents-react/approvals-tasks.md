# Approvals and tasks

A backend approval/question and a host permission request share a place in the composer, but keep separate owners. The backend owns chat request IDs, allowed decisions, and settlement events. The host owns extra `HostPrompt` data and its permission policy.

## Pending requests and refusal behavior

`waitingRequestsOf(chat)` includes pending approvals and questions from visible history and before the loaded page. Approvals block. A question with `async: true` is optional; other questions block. `orderPrompts` puts blocking requests first, oldest first within each group. A request the person is already reading remains active when another arrives.

`PromptComposer` handles the combined stack. It keeps the CodeMirror editor mounted but hidden while a card is active, preserving its draft and selection. `answerPromptsElsewhere` on `Composer` points to a separate host surface instead of drawing answers locally. The host must actually provide that surface.

Approval decisions are `allow`, `allow-always`, and `deny`. The lasting decision is shown only when the item advertises both its capability and label/details. The keyboard's initial selection never starts on a lasting grant. A denial may carry a trimmed reason. The backend still decides whether the request exists and the decision is valid.

Questions retain a draft per request while paging. Multi-select choices become comma-separated answer strings; custom answers are trimmed. The final answer is enabled only when every question has a nonempty answer. Optional questions can be dismissed. A refused action leaves the card and its draft in place with the error message.

## Compose a separate request panel

This panel uses the real session and view types. Render it inside a `ChatScopeContext` and pass subjects constructed from current chat items or extra host prompts. The caller supplies connection state as `disabled`.

```tsx
import { useChatActions } from '@adecore/agents-react/chat/actions';
import { orderPrompts } from '@adecore/agents-react/prompts/logic/prompts';
import { answerPrompt, isBlockingSubject, promptCreatedAt, promptIdOf, type PromptSubject } from '@adecore/agents-react/prompts/logic/subjects';
import { usePromptSession } from '@adecore/agents-react/prompts/logic/usePromptSession';
import { PromptView } from '@adecore/agents-react/prompts/ui/PromptView';

function pickSubject(waiting: readonly PromptSubject[], id: string | null): PromptSubject | null {
    return waiting.find((subject) => promptIdOf(subject) === id) ?? orderPrompts(waiting, isBlockingSubject, promptCreatedAt)[0] ?? null;
}

export function RequestPanel({ subjects, disabled }: { subjects: readonly PromptSubject[]; disabled: boolean }) {
    const actions = useChatActions();
    const session = usePromptSession({ prompts: subjects, idOf: promptIdOf, pick: pickSubject, disabled });
    const active = session.active;
    if (!active) {
        return null;
    }
    const id = promptIdOf(active);
    return (
        <div onPointerDownCapture={session.onPointerDownCapture} onClickCapture={session.onClickCapture}>
            <PromptView
                subject={active}
                draft={session.draftOf(id)}
                onDraft={(draft) => session.setDraft(id, draft)}
                onAction={(action) => {
                    void session.act(active, () => answerPrompt(active, action, actions));
                }}
                more={session.waiting.length - 1}
                hasDraft={false}
                denyReason
                disabled={disabled}
                sending={session.sending}
                error={session.errorOf(id)}
            />
        </div>
    );
}
```

`usePromptSession.act` returns `sent`, `failed`, or `busy`. It serializes answers, hides a locally answered subject while the backend settles it, and prevents a pointer press begun on an earlier card from activating a newly arrived approval. Keep both capture handlers. A custom panel also owns its paging controls and focus restoration; `useFocusAfterAnswer`, `focusPromptHeading`, and `focusPromptStart` support that integration.

## Extra host prompts

`ChatHost.prompts` is a complete nested adapter:

```ts
import { setChatHost } from '@adecore/agents-react/host';
import type { HostPrompt, PromptViewProps } from '@adecore/agents-react/prompts/logic/subjects';
import type { PromptAction } from '@adecore/agents-react/prompts/logic/prompts';
import type { ReactNode } from 'react';

export function installHostPrompts(adapter: {
    useExtra(scopeId: string, chatId: string): readonly HostPrompt[];
    render(prompt: HostPrompt, props: PromptViewProps): ReactNode;
    answer(prompt: HostPrompt, action: PromptAction): Promise<void>;
}): void {
    setChatHost({ prompts: adapter });
}
```

The passed adapter is host-provided, not a package permission service. A `HostPrompt` has a stable unique `id`, `createdAt`, `blocking`, `asks: 'approval' | 'question'`, and `data: unknown`. Keep the object stable while its data is unchanged. The adapter validates `data`, renders the controls, and checks authorization when answering. `choose` actions are available for host-specific choices; chat requests support approve, answer, and dismiss.

## Keyboard and focus

Within a prompt, arrows and Home/End move through choices; Space picks. Enter on a single-select question picks and commits. In multi-select, the first Enter can pick a choice, and a later Enter advances when a choice exists. Mod+Enter invokes the primary action. Mod+Shift+Left/Right pages a stack only outside text fields. IME keys stay with composition.

Unmodified keys remain inside the card, while Tab and Escape can leave. When an incoming request interrupts a typed draft, the default composition focuses the heading rather than a decision button. It restores composer focus after the final answer from the card. Retain those behaviors when replacing the default UI.

## Child agents and tasks

The timeline can open a child's read-only conversation by `toolUseId`. `SubagentConversation` calls `chat.subagent`, follows `chat.subagentChanged`, reads 60-item pages, and reestablishes a watch on reconnect. Construct once, call `start()` once, and call `dispose()` on unmount. Disposal unsubscribes and asks `watch: false` while the link is open; it does not stop the child.

`unknown-request` marks child-conversation support as unavailable for that scope. The package can still display the child row from the parent thread. `history-expired` reloads the child's newest page. A reconnect failure preserves already-ready content; the next open link reads it again. Neither the controller nor a read-only child timeline is a general child-chat send interface.

`ChatHost.tasks` subscribes to host task state by scope and task ID. A task has status `open`, `done`, `failed`, or `cancelled`, creation/settlement times, and optional paused data. `taskStatusWord` maps an open paused task to the paused appearance. Child stopping uses `stopSubagent` or `stopTask`; the host's `confirm` hooks receive `run` and decide when to invoke it. Their defaults invoke immediately. Closing a view is not cancellation.
