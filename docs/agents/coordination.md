# Coordination

Modules for agents that hand each other work: an outbox that survives restarts, tasks between a chat and the chats it opened, the lineage of who opened whom, and messages between chats. A plain `AgentHost` installs none of them. A host that lets agents work together composes them around its core. Keep their files outside every folder an agent can write to, and check who may do what before a call reaches them.

## Outbox

`OutboxStore` keeps one record per pending job under `outbox/`, validated by a Zod schema. `OutboxWorker` runs them oldest first per target, with targets in parallel. `enqueue` resolves once the work is on disk, not once it ran.

```ts
import { z } from 'zod';
import { OutboxStore, OutboxWorker } from '@adecore/agents/coordination';
import { ManualClock } from '@adecore/agents/testing';

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

A handler that throws retries after the delays in `RETRY_DELAYS_MS`, then goes to `onParked`, where you record the failure. A handler that returns `'wait'` keeps its entry, without using an attempt, until `wake(target)`. A handler can run twice after a crash, so make it idempotent by keying its writes on the entry's id.

`stop()` schedules nothing more and lets running handlers finish. `settled()` waits for those, not for retries or waiting entries. `ManualClock` moves time by hand in a test.

## Tasks

A task is what a chat asked of a chat it opened. `TaskStore` keeps them under `tasks/`. `wireTasks` builds the coordinator that settles tasks, the outbox work that starts and wakes chats, and the verbs a context command calls. A set and an array stand in for your app's placement and notifications here:

```ts
import { z } from 'zod';
import type { ChatCore } from '@adecore/agents/chat';
import { OutboxStore, OutboxWorker, TaskStore, restartBackgroundLimits, BackgroundLimitWorkSchema, DeliverWaitingWorkSchema, GiveTaskWorkSchema, WakeParentWorkSchema, wireTasks } from '@adecore/agents/coordination';

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

- `verbs.open(record)` records a task for a chat the caller just opened. Starting that chat is yours. `verbs.give(record)` gives a task to an existing chat and owes it the turn. `verbs.done(childId, text)` settles the child's open task. `chatState(nodeId)` says whether a chat is missing, idle or running, and `involving(nodeId)` lists its tasks.
- A task settles when the child says done, when its first turn ends, or when its process leaves. Running subagents, workflows and background commands (up to 30 minutes) keep it open. An active goal keeps it open until the goal is met, paused or cleared. A child waiting out a usage limit stays open and wakes nobody.
- A task with a `machine` has a child that runs elsewhere, and nothing local settles it. `coordinator.settleFromElsewhere(taskId, result, status = 'done')` settles it and wakes the parent once. It returns `null` on a second call or without `machine`. Record where a node's opener runs with `peer: { machineId }` on `AgentLineageStore.put`, and read it with `peerOf(nodeId)`.
- A settled task wakes its parent once the parent is idle. Tasks of one `batchId` wake it together. The wake carries the start of the result, and `words.restOf(childId)` says where to read the rest.
- A child's approval or question that waits 15 seconds leaves a note in the parent without starting a turn.
- `prune(projectId, ids)` cancels the tasks of chats your app removed.

`TaskStore.subscribe` reports every task written. Send it over your own protocol as `TaskChangedEventSchema`. Call `wireTasks` once per core.

## Lineage

`AgentLineageStore` records under `lineage/` which chat opened which, with depth, project, runtime mode ceiling and end time. A fork a person made has `relation: 'fork'` and is no descendant. `depthOf` and `openedCount` let your app cap depth and count. The store caps nothing itself. Keep the ceiling `ceilingForOpening(opener, requested)` returns and clamp later starts with `narrowerMode`, so a restart never widens an agent.

`endChildren` ends the chats a chat opened, recursively. Add `EndChildrenWorkSchema` to the outbox. `owe(target)` writes the obligation first. Its handler marks the lineage ended, removes work that would restart them, cancels their tasks and stops them deepest first through your `stop(nodeId, reason)`. List every kind of your own work that would restart a chat in `reviving`.

`rehome(nodeId, projectId)` moves a node's record to another project, for a chat your app moved. It returns false when no record exists.

## Messages

`NoticeStore` keeps messages waiting for a chat under `notices/`, capped per chat and in age. `take` hands them to the model once. `show` marks them seen by a person, independently.

After you checked who may write to whom, `deliverToChat(store, chatNoticeTargets(core), notice)` stores a message and returns what happens next:

| Result | Meaning |
| --- | --- |
| `wake` | A turn is owed. Enqueue a `DeliverMessageWorkSchema` entry, handled by `deliverMessageHandler`. |
| `no-chat`, `in-turn` | The message waits for the chat's next prompt. |
| `from-message` | The writing turn was itself started by a message, so it wakes nobody. Two chats cannot wake each other forever. |

One exception: a turn a message started wakes the sender it answers, while that sender's own turn was started by no message. A question and its answer take two steps, and the turn the answer starts wakes nobody. `ChatNoticeTargets.wokenBy(id)` names the senders whose message started a node's turn.

`NoticeNotes` hands waiting messages to the next prompt through `promptNotesFor`. `unshownNotes` and `showNotices` show them to a person.
