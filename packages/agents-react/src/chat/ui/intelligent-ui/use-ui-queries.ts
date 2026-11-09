import type { ChatUiQueryReading, ChatUiQueryState } from '@adecore/agent-contracts';
import { uiInputValues, uiNodeQueries, UI_CATALOG_VERSION, UI_HOST_LIMITS, UiState, type UiBlock, type UiViewNode } from '@adecore/intelligent-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatHost } from '../../../host/host';
import { UiPageMemory } from './block-local';
import type { UiLiveNodeState, UiLiveValue, UiLiveStatus, UiRenderContext } from './render-context';

interface LocalReading {
    identity: string;
    reading: ChatUiQueryReading;
    successful?: { inputs: string; reading: ChatUiQueryReading };
}

const NO_READINGS: ChatUiQueryState['blocks'][string]['readings'] = {};
// A changed input reads once it has rested this long, so dragging a slider reads its last value only.
const INPUT_SETTLE_MS = 300;

// What each block last read, so a block the thread unmounts while scrolling comes back with its own last value rather than the frozen first one.
const remembered = new UiPageMemory<Record<string, LocalReading>>(64);

/* Answers for a read the host never tried; while a value stands they say nothing about it. */
const NOT_TRIED = new Set(['busy', 'refresh-limit']);

/* The reading that holds for these inputs: this view's own read of them, or the frozen first one for the inputs the block starts with. */
function successfulReading(
    local: LocalReading | undefined,
    initial: ChatUiQueryReading | undefined,
    identity: string,
    signature: string,
    defaultInputs: string
): ChatUiQueryReading | undefined {
    if (local?.identity === identity && local.successful?.inputs === signature) {
        return local.successful.reading;
    }

    return signature === defaultInputs && initial?.state === 'fresh' ? initial : undefined;
}

function settleDeadline(): number {
    return Date.now() + INPUT_SETTLE_MS;
}

function documentVisible(): boolean {
    return document.visibilityState !== 'hidden';
}

export function useUiQueries(
    block: UiBlock,
    state: UiState,
    context: Pick<UiRenderContext, 'scopeId' | 'chatId' | 'itemId' | 'phase'>,
    element: HTMLDivElement | null,
    frozen?: ChatUiQueryState['blocks'][string]
) {
    const host = useChatHost();
    const memoryKey = JSON.stringify([context.scopeId, context.chatId, context.itemId, block.id]);
    const [readings, setReadings] = useState<Record<string, LocalReading>>(() => remembered.get(memoryKey) ?? {});

    useEffect(() => {
        remembered.set(memoryKey, readings);
    }, [memoryKey, readings]);

    const [busyInput, setBusyInput] = useState<string | null>(null);
    const lastRead = useRef({ inputKey: '', at: 0 });
    const names = Object.keys(block.queries);
    const inputs = JSON.stringify(uiInputValues(block, state));
    const identity = JSON.stringify([context.scopeId, context.chatId, context.itemId, block.id, block.revision]);
    const inputKey = JSON.stringify([identity, inputs]);
    const reading = busyInput === inputKey;
    const defaultInputs = useMemo(() => JSON.stringify(uiInputValues(block, new UiState(block))), [block]);
    const initial = frozen && frozen.revision === block.revision ? frozen.readings : NO_READINGS;

    const successfulFor = (name: string, signature: string): ChatUiQueryReading | undefined =>
        successfulReading(readings[name], initial[name], identity, signature, defaultInputs);

    const readsFor = (values: Readonly<Record<string, unknown>>): Record<string, string> | null => {
        const signature = JSON.stringify(values);
        const reads: Record<string, string> = {};

        for (const name of names) {
            const local = readings[name];
            const successful = successfulFor(name, signature);

            if (!successful?.readId || (local?.identity === identity && local.reading.state === 'refused')) {
                return null;
            }

            reads[name] = successful.readId;
        }

        return reads;
    };

    const reads = readsFor(JSON.parse(inputs));
    const ready = reads !== null;
    const query = host.intelligentUi?.query;
    const subscribe = host.intelligentUi?.subscribe;

    useEffect(() => {
        const scope = state.scope();

        for (const name of Object.keys(block.queries)) {
            const successful = successfulReading(readings[name], initial[name], identity, inputs, defaultInputs);

            if (successful && JSON.stringify(scope[name]) !== JSON.stringify(successful.value)) {
                state.setQuery(name, successful.value, block);
            }
        }
    }, [state, block, readings, identity, inputs, defaultInputs, initial]);

    useEffect(() => {
        if (
            !query ||
            !element ||
            !block.complete ||
            block.catalogVersion !== UI_CATALOG_VERSION ||
            !block.revision ||
            !Object.keys(block.queries).length ||
            context.phase !== 'final'
        ) {
            return;
        }

        let stopped = false;
        let visible = typeof IntersectionObserver === 'undefined';
        let busy = false;

        let timer: ReturnType<typeof setTimeout> | null = null;
        // The first read of this block reads at once; a changed input waits until it rests.
        const changed = lastRead.current.inputKey !== '' && lastRead.current.inputKey !== inputKey;
        const settledAt = changed ? settleDeadline() : 0;

        const refresh = async () => {
            if (stopped || !visible || !documentVisible() || busy) {
                return;
            }

            const wait = Math.max(
                settledAt - Date.now(),
                lastRead.current.inputKey === inputKey ? UI_HOST_LIMITS.refreshMilliseconds - (Date.now() - lastRead.current.at) : 0
            );

            if (wait > 0) {
                if (timer === null) {
                    if (!visible || !documentVisible()) {
                        return;
                    }

                    timer = setTimeout(() => {
                        timer = null;
                        void refresh();
                    }, wait);
                }

                return;
            }

            busy = true;
            lastRead.current = { inputKey, at: Date.now() };
            setBusyInput(inputKey);

            for (const name of Object.keys(block.queries).slice(0, UI_HOST_LIMITS.queries)) {
                if (!visible || !documentVisible()) {
                    break;
                }

                try {
                    const reading = await query(context.scopeId, {
                        chatId: context.chatId,
                        itemId: context.itemId,
                        blockId: block.id,
                        revision: block.revision!,
                        query: name,
                        values: JSON.parse(inputs)
                    });

                    if (stopped) {
                        return;
                    }

                    if (reading.state === 'fresh') {
                        state.setQuery(name, reading.value, block);
                    }

                    setReadings((previous) => {
                        const untried = reading.state === 'failed' && reading.code !== undefined && NOT_TRIED.has(reading.code);

                        // The next refresh tries again; until then the value and any real reason it failed stay as they are.
                        if (untried && successfulReading(previous[name], initial[name], identity, inputs, defaultInputs) !== undefined) {
                            return previous;
                        }

                        return {
                            ...previous,
                            [name]: {
                                identity,
                                reading,
                                successful:
                                    reading.state === 'fresh'
                                        ? { inputs, reading }
                                        : previous[name]?.identity === identity
                                          ? previous[name].successful
                                          : undefined
                            }
                        };
                    });
                } catch (error) {
                    if (stopped) {
                        return;
                    }

                    setReadings((previous) => ({
                        ...previous,
                        [name]: {
                            identity,
                            reading: { state: 'failed', readAt: Date.now(), code: 'unreadable', reason: error instanceof Error ? error.message : undefined },
                            successful: previous[name]?.identity === identity ? previous[name].successful : undefined
                        }
                    }));
                }
            }

            busy = false;

            if (stopped) {
                return;
            }

            setBusyInput(null);

            timer = setTimeout(() => {
                timer = null;
                void refresh();
            }, UI_HOST_LIMITS.refreshMilliseconds);
        };

        const observer =
            typeof IntersectionObserver === 'undefined'
                ? null
                : new IntersectionObserver((entries) => {
                      visible = entries.some((entry) => entry.isIntersecting);

                      if (visible) {
                          void refresh();
                      } else if (timer !== null) {
                          clearTimeout(timer);
                          timer = null;
                      }
                  });

        if (element) {
            observer?.observe(element);
        }

        const focus = () => {
            void refresh();
        };

        document.addEventListener('visibilitychange', focus);
        const unsubscribe = subscribe?.(context.scopeId, context.chatId, focus);
        void refresh();

        return () => {
            stopped = true;
            // A read cut short by this cleanup never reaches its own reset, which would leave the choices closed.
            setBusyInput((current) => (current === inputKey ? null : current));
            observer?.disconnect();
            unsubscribe?.();
            document.removeEventListener('visibilitychange', focus);

            if (timer !== null) {
                clearTimeout(timer);
            }
        };
    }, [
        block,
        state,
        context.scopeId,
        context.chatId,
        context.itemId,
        context.phase,
        inputs,
        query,
        subscribe,
        element,
        identity,
        inputKey,
        initial,
        defaultInputs
    ]);

    const currentReadings = Object.fromEntries(
        names.flatMap((name) => {
            const local = readings[name];
            const reading = local?.identity === identity ? local.reading : initial[name];

            return reading ? [[name, reading]] : [];
        })
    );

    const failed = Object.entries(currentReadings).find(([, value]) => value.state !== 'fresh');

    const live: UiLiveStatus | undefined = names.length
        ? {
              state: reading || (!ready && !failed) ? 'reading' : (failed?.[1].state ?? 'fresh'),
              sources: names.map((name) => block.queries[name].source),
              // From the readings that hold, so a failure does not take away when the value on screen was read.
              readAt: names
                  .flatMap((name) => successfulFor(name, inputs) ?? [])
                  .reduce<number | null>((at, value) => (at === null ? value.readAt : Math.min(at, value.readAt)), null),
              source: failed ? block.queries[failed[0]]?.source : undefined,
              reason: failed?.[1].reason,
              code: failed?.[1].code
          }
        : undefined;

    return { live, reads: reads ?? {}, reading, ready, readsFor, currentReadings };
}

export function useUiLiveValues(block: UiBlock, nodes: readonly UiViewNode[], readings: Readonly<Record<string, ChatUiQueryReading>>) {
    const [committed, setCommitted] = useState<{ token: string; values: Map<string, Record<string, unknown>>; previous: Map<string, Record<string, unknown>> }>(
        {
            token: '',
            values: new Map(),
            previous: new Map()
        }
    );

    const dependencies = useMemo(() => uiNodeQueries(block), [block]);
    const names = new Set(Object.keys(block.queries));
    const values = new Map<string, Record<string, unknown>>();
    const sources = new Map<string, readonly string[]>();

    const collect = (nodes: readonly UiViewNode[]) => {
        for (const node of nodes) {
            const related = dependencies[node.sourceId ?? node.id];

            if (related !== undefined && !node.error) {
                values.set(node.id, node.props);
                sources.set(node.id, related);
            }

            collect(node.children);
        }
    };

    collect(nodes);
    const token = JSON.stringify([block.revision, Object.entries(readings).map(([name, reading]) => [name, reading.state, reading.readId, reading.readAt])]);
    const previous = committed.token === token ? committed.previous : committed.values;

    if (committed.token !== token) {
        setCommitted({ token, values, previous });
    }

    if (!names.size) {
        return { liveValue: undefined, liveNode: undefined };
    }

    const stale = (related: readonly string[]) => related.some((name) => readings[name]?.state === 'failed' || readings[name]?.state === 'refused');

    const liveValue = (id: string, prop: string, path?: readonly [number, string]): UiLiveValue | undefined => {
        const related = sources.get(id);

        if (!related) {
            return undefined;
        }

        const before = previous.get(id)?.[prop];
        const now = values.get(id)?.[prop];

        // A row added or taken away moves every row under it, so a cell compares only while the rows are the ones it had.
        const moved = path !== undefined && (!Array.isArray(before) || !Array.isArray(now) || before.length !== now.length);
        const was = path && Array.isArray(before) ? before[path[0]]?.[path[1]] : before;
        const is = path && Array.isArray(now) ? now[path[0]]?.[path[1]] : now;

        return {
            previous: moved ? undefined : was,
            changed: !moved && was !== undefined && JSON.stringify(was) !== JSON.stringify(is),
            stale: stale(related)
        };
    };

    const liveNode = (id: string): UiLiveNodeState | undefined => {
        const related = sources.get(id);

        return related === undefined ? undefined : stale(related) ? 'stale' : 'live';
    };

    return { liveValue, liveNode };
}
