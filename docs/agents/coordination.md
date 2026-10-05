# Durable coordination

A plain `AgentHost` does not install tasks, messages, lineage, or a context endpoint. Compose these modules when your consumer supports agents assigning work to each other. Persist their stores outside the agent-writable project and enforce ownership before invoking a verb.

## Outbox

`OutboxStore` keeps one validated record per owed operation under `outbox/`. `OutboxWorker` executes operations oldest first per target; separate targets can run concurrently. `enqueue` resolves when work is on disk, not when its handler finishes.

```ts
import { z } from 'zod';
import { OutboxStore } from '@adecore/agents/outbox/outbox';
import { OutboxWorker } from '@adecore/agents/outbox/outbox-worker';
import { ManualClock } from '@adecore/agents/outbox/manual-clock';

export async function runOutboxExample(dataDir: string): Promise<string[]> {
    const WorkSchema = z.object({ kind: z.literal('record-result'), payload: z.object({ text: z.string() }) });
    const store = new OutboxStore({ dataDir, work: WorkSchema });
    await store.load();
    const completed = new Map<string, string>();
    const clock = new ManualClock();
    const worker = new OutboxWorker({
        store,
        clock,
        handlers: {
            'record-result': async (entry) => {
                completed.set(entry.id, entry.payload.text);
            }
        }
    });
    worker.start();
    try {
        await worker.enqueue('project-1', 'child-1', { kind: 'record-result', payload: { text: 'Checked the fixture.' } });
        await worker.settled();
        return [...completed.values()];
    } finally {
        worker.stop();
    }
}
```

The in-memory result handler is idempotent within this fixture. Production handlers need idempotence across restarts: if an operation succeeds before its record is removed, it can run again after a crash. Use entry ids or domain operation ids in your destination store.

A thrown handler retries after 1, 5, and 30 seconds. The next failure removes the entry, logs it, and calls `onParked`; parking is not a retained dead-letter file. Persist your own failure record there if needed. Returning `'wait'` retains work without consuming an attempt and waits for `wake(target)`. Waiting entries and newly scheduled future work hold no lane; retries retain ordering for their target. `lanesOf` can name additional resources held by running work. `outlivesTarget` preserves shutdown work when `prune` drops a removed target.

`worker.stop()` cancels future scheduling but does not abort an in-flight handler. Await `settled()` to drain running work; it excludes future retries and entries waiting for a wake. Keep handler cancellation and service shutdown explicit in the host.

## Wire tasks

The following function is a complete task adapter for an existing `ChatCore`. The `placedIds` set and alert collection stand in for host placement and notification services. It adds all four task work kinds to one outbox, recovers persisted obligations before starting, and exposes task verbs.

```ts
import { z } from 'zod';
import type { ChatCore } from '@adecore/agents/chat/chat-core';
import { OutboxStore } from '@adecore/agents/outbox/outbox';
import { OutboxWorker } from '@adecore/agents/outbox/outbox-worker';
import { TaskStore } from '@adecore/agents/tasks/task-store';
import { restartBackgroundLimits } from '@adecore/agents/tasks/background-limit';
import { BackgroundLimitWorkSchema, DeliverWaitingWorkSchema, GiveTaskWorkSchema, WakeParentWorkSchema } from '@adecore/agents/tasks/task-work';
import { wireTasks } from '@adecore/agents/tasks/wiring';

export async function openTaskServices(dataDir: string, chats: ChatCore, placedIds: ReadonlySet<string>) {
    const WorkSchema = z.discriminatedUnion('kind', [BackgroundLimitWorkSchema, DeliverWaitingWorkSchema, GiveTaskWorkSchema, WakeParentWorkSchema]);
    const outbox = new OutboxStore({ dataDir, work: WorkSchema });
    const tasks = new TaskStore(dataDir);
    await outbox.load();
    await tasks.load();
    await restartBackgroundLimits(outbox, Date.now());
    const alerts: Array<{ nodeId: string; title: string; body: string }> = [];
    let worker: OutboxWorker<z.infer<typeof WorkSchema>>;
    const wiring = wireTasks({
        tasks,
        chats,
        outbox: {
            list: () => outbox.list(),
            enqueue: (projectId, target, work, notBefore) => worker.enqueue(projectId, target, work, notBefore),
            remove: (id) => outbox.remove(id),
            wake: (target) => worker.wake(target)
        },
        placed: (nodeId) => placedIds.has(nodeId),
        titleFor: (nodeId) => (placedIds.has(nodeId) ? nodeId : null),
        alert: (nodeId, title, body) => {
            alerts.push({ nodeId, title, body });
        },
        words: { app: 'Example host', cli: 'app-context' }
    });
    worker = new OutboxWorker({ store: outbox, handlers: wiring.handlers, onParked: wiring.onParked });
    await wiring.recover();
    worker.start();
    return {
        tasks,
        wiring,
        worker,
        alerts,
        async close(): Promise<void> {
            wiring.waiting.stop();
            wiring.coordinator.stop();
            worker.stop();
            await wiring.coordinator.settled();
            await worker.settled();
        }
    };
}
```

`verbs.open(record)` records a task for a newly opened child; the consumer still owes starting that child. `verbs.give(record)` records a task and owes a turn to a child that already exists. `verbs.done(childId, text)` explicitly settles its open task. `chatState` distinguishes missing, idle, and running chats; `involving` lists parent/child tasks.

A task normally settles on the child's final answer or explicit completion, but native background subagents/workflows hold it open. Background shell/monitor commands hold it for at most 30 minutes. A restart converts persisted background command limits into immediate restart failures. Usage/overload pauses remain open when recovery is owed.

A settled task wakes its parent once the parent has no active turn. Tasks with the same `batchId` wake it together. Wake results are clipped to an 8 KiB text budget; supply `words.restOf(childId)` for the remaining result location. `words.assignment` supplies host assignment wording. A child approval/question that stays pending for 15 seconds leaves a note in the parent without opening a parent turn.

`TaskStore.subscribe` emits `task.changed` through a consumer-owned transport. This event is separate from the standard agent schema table. `prune(projectId, ids)` cancels tasks involving removed nodes rather than reporting a child failure. `coordinator.startFailed`/`agentEnded` let the host report failed launch or terminal-agent exit.

`wireTasks` installs observers for the supplied core and store and returns no unsubscription for them. Use one task wiring for that core's lifetime; the example's close stops timers/work but does not support repeatedly mounting a new task wiring on the same live core. Dispose the containing host after closing task services.

## Lineage and descendant shutdown

`AgentLineageStore` records opener, depth, project, mode ceiling, and end marks under `lineage/`. `relation: 'fork'` represents a person-created sibling and excludes that node from ordinary opened-agent descendants. The host decides recursion and per-caller caps using `depthOf` and `openedCount`; the store itself imposes no numeric cap.

`ceilingForOpening` refuses a requested mode wider than the opener's. Persist its returned ceiling and clamp later starts with `narrowerMode` so a restart cannot widen an agent's permission.

`endChildren` requires lineage, tasks, outbox, an idempotent `stop(nodeId, reason)`, and host cleanup. Add `EndChildrenWorkSchema` to your outbox, keep its entry through target pruning, and assign lanes for all named descendants. `owe(target)` persists descendant shutdown first. Its handler marks lineage ended, removes reviving work, cancels tasks/drops parent wakes, then stops descendants deepest first. Add every host work kind that can revive an agent to `reviving`, including message or resume work if you use it.

## Messages

`NoticeStore` retains at most ten notices per receiver for six hours under `notices/`. `take` consumes the model's queue once; `show` independently marks notices displayed to a person. Await `settled()` after a synchronous `take` when you need its file removal to finish.

After checking sender/receiver permissions, call `deliverToChat(store, chatNoticeTargets(core), notice)`. Outcomes are `wake`, `no-chat`, `in-turn`, and `from-message`; only `wake` owes a `DeliverMessageWorkSchema` entry. Busy or unopened chats read the queue before their next prompt. A turn opened by a message cannot wake another chat with its own message, preventing reciprocal wake loops.

Integrate `NoticeNotes` through `promptNotesFor`, `unshownNotes` through `opened`, and `showNotices` for immediate human-visible delivery. `deliverMessageHandler` uses a host `chat` opener, `placed` check, and `MessageWords.prompt`/`label`. `heard` and `shown` also belong to `MessageWords`. A message handler makes one attempt to open a turn; if the chat is now busy, its next ordinary prompt consumes the notices. Terminal delivery and authorization remain host operations.
