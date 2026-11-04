# Async

```ts
import { KeyedSerializer, Serializer, SingleFlight, wait, withTimeout } from '@adecore/utils/async';
```

Helpers for time and for the order of async work. They run in a page and in Node.

## Waiting

`wait(ms, signal)` resolves after `ms`. An abort resolves it early instead of rejecting, because the loops that wait check the signal on their next turn:

```ts
while (!signal.aborted) {
    await poll();
    await wait(5_000, signal);
}
```

Each wait takes its abort listener back when it ends, so one long-lived signal can serve many waits.

## Deadlines

`withTimeout(promise, ms, message)` rejects with `message` once `ms` passed, and clears its timer either way. A call that answers at once does not hold the process open until its deadline.

```ts
const status = await withTimeout(fetchStatus(), 10_000, 'The status took too long.');
```

`withDeadline(promise, ms, message, timer)` is the same with the timer passed in. The `DeadlineTimer` it takes has `setTimeout` and `clearTimeout`, so a test can drive the clock.

## Timers

A `Timer` runs a callback after a delay and returns how to cancel it. Code that takes a `Timer` instead of calling `setTimeout` can be tested without real time.

- `cancellableTimeout` keeps the process alive until it fires.
- `unrefTimeout` does not, for a timer that should never be the reason a process stays up.

```ts
function scheduleRetry(timer: Timer, retry: () => void): () => void {
    return timer(1_000, retry);
}

const cancel = scheduleRetry(unrefTimeout, reconnect);
```

## One at a time

`Serializer` runs one piece of work at a time. The next starts once the one before settled, kept or broken, and every caller gets its own result. Two changes in a row never read the same file and drop one of them.

```ts
const writes = new Serializer();

export function saveSettings(settings: Settings): Promise<void> {
    return writes.run(() => writeAtomic(SETTINGS_FILE, JSON.stringify(settings)));
}
```

`idle()` resolves when the queue is empty, without adding work of its own. Await it before the process exits.

`KeyedSerializer` does the same per key, for a store whose records are written one by one and never wait on each other. It drops a key once its last work settled, and `size` reports how many keys still have work:

```ts
const writes = new KeyedSerializer();

export function saveRecord(id: string, write: () => Promise<void>): Promise<void> {
    return writes.run(id, () => withTimeout(write(), 10_000, `Saving ${id} took too long.`));
}
```

## Once per key

`SingleFlight` runs work once per key at a time. A caller that asks while the work runs gets the same promise, and a key that settled leaves nothing behind, so the next call runs the work again:

```ts
const loads = new SingleFlight<Project>();

export function loadProject(path: string): Promise<Project> {
    return loads.run(path, () => readProject(path));
}
```

`get(key)` returns the run in flight, and `has(key)` says whether there is one.
