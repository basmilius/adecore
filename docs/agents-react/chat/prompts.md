# Prompts

The cards for a chat's approvals and questions. The [composer](/agents-react/chat/composer) draws them for its chat and its delegated chats. The parts are exported for a stack elsewhere, such as over a canvas of chats.

```tsx
import { PromptView, usePromptSession } from '@adecore/agents-react/prompts';
```

<Demo src="agents/prompts" />

## What a person sees

An approval names the tool and shows the command or diff, with Deny and Allow. When the CLI proposes a rule to remember, a third button grants it for good. The keyboard never starts on Allow or that button. A denial can carry a reason when the CLI takes one.

A question shows single or multiple choices, or a field for a written answer. Several questions page before they are answered together. Multiple picks are joined by commas. A question marked `async` can be dismissed.

Blocking requests come first, oldest first, then optional questions. A new request never replaces the card being read. A refusal keeps the card, with the host's message under it.

A delegated request carries a badge with the subagent's task, and its answer goes to the child chat.

## A stack of your own

`ChatPromptFeed` from `@adecore/agents-react/chat` feeds the same subjects to another surface. Construct it with a `ChatScope`, the main chat id and a callback, call `start()`, and `dispose()` when the surface closes. It attaches child chats through `ChatClient.observe(chatId)`, which returns a release function.

`usePromptSession` holds a stack's state: the subject in front, a draft per request, sending and the last error. `PromptView` draws one subject. `answerPrompt(subject, action, actions, host)` sends a card's action, or hands it to the host's `prompts.answer` for a prompt of your app.

```tsx
import { useChatActions } from '@adecore/agents-react/chat';
import { useChatHost } from '@adecore/agents-react';
import { orderPrompts, answerPrompt, isBlockingSubject, promptCreatedAt, promptIdOf, type PromptSubject } from '@adecore/agents-react/prompts';

const pick = (waiting: readonly PromptSubject[], id: string | null): PromptSubject | null =>
    waiting.find((subject) => promptIdOf(subject) === id) ?? orderPrompts(waiting, isBlockingSubject, promptCreatedAt)[0] ?? null;

function Stack({ subjects }: { subjects: PromptSubject[] }) {
    const actions = useChatActions();
    const host = useChatHost();
    const session = usePromptSession({ prompts: subjects, idOf: promptIdOf, pick, disabled: false });
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
                onAction={(action) => void session.act(active, () => answerPrompt(active, action, actions, host))}
                more={session.waiting.length - 1}
                hasDraft={false}
                denyReason
                disabled={false}
                sending={session.sending}
                error={session.errorOf(id)}
            />
        </div>
    );
}
```

A chat's `PromptSubject` is `{ kind: 'chat', nodeId, item }`, where `nodeId` is the chat that gets the answer. An optional `source: { label, provider? }` names the delegated agent for the badge. A prompt of your app is `{ kind: 'host', nodeId, prompt }`. Keep both capture handlers on the element around the card, so a press never answers a card that replaced the one it started on. `act` returns `sent`, `failed` or `busy`, sends one answer at a time and hides an answered card until the host settles it.

## Keys

Arrows, Home and End move through the choices and Space picks; Enter on a single choice picks and answers. Mod+Enter is the card's main action, and Mod+Shift+Left and Right page through a stack (`PROMPT_SHORTCUTS`). A request that arrives while a person types puts the focus on its heading, not a button. `focusPromptStart` and `useFocusAfterAnswer` do the same for a stack of your own.

## Prompts of your own

The host's `prompts` adds prompts of your app beside a chat's, answered in the same place:

```tsx
const CHAT_HOST: Partial<ChatHost> = {
    prompts: {
        useExtra: (scopeId, chatId) => usePermissionRequests(scopeId, chatId),
        render: (prompt, props) => <PermissionCard prompt={prompt} {...props} />,
        answer: (prompt, action) => permissions.answer(prompt.id, action)
    }
};
```

A `HostPrompt` is `{ id, createdAt, blocking, asks, data }`: a stable id, whether it blocks, `approval` or `question` for its mark, and your own `data`. Return the same objects from `useExtra` while nothing changed. `PromptCard`, `PromptPrimary` and `ApprovalActions` build a matching card, and a `choose` action answers with a choice of your own.

## Parts

`PromptView` is made of `PromptCard` (the frame with heading, meta, notice and error), the approval and question bodies, and the action rows. `PROMPT_SURFACE` is the card's surface class, for a matching frame. `emptyPromptDraft` and `orderPrompts` are pure helpers for a stack of your own.
