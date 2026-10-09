import { useEffect, useRef, useState } from 'react';
import type { ChatUiQueryReading, ChatUiQueryState } from '@adecore/agent-contracts';
import { uiInputValues, UI_CATALOG_VERSION, UI_HOST_LIMITS, UiState, type UiBlock, type UiViewNode, type UiNode } from '@adecore/intelligent-ui';
import { chatHost } from '../../../host';
import type { UiLiveValue, UiLiveStatus, UiRenderContext } from './render-context';

interface LocalReading {
    identity: string;
    reading: ChatUiQueryReading;
    successful?: { inputs: string; reading: ChatUiQueryReading };
}

function documentVisible(): boolean {
    return document.visibilityState !== 'hidden';
}

export function useUiQueries(
    block: UiBlock,
    state: UiState,
    context: UiRenderContext,
    element: HTMLDivElement | null,
    frozen?: ChatUiQueryState['blocks'][string]
) {
    const [readings, setReadings] = useState<Record<string, LocalReading>>({});
    const [busyInput, setBusyInput] = useState<string | null>(null);
    const lastReadAt = useRef({ identity: '', at: 0 });
    const names = Object.keys(block.queries);
    const inputs = JSON.stringify(uiInputValues(block, state));
    const identity = JSON.stringify([context.scopeId, context.chatId, context.itemId, block.id, block.revision]);
    const inputKey = JSON.stringify([identity, inputs]);
    const reading = busyInput === inputKey;
    const defaultInputs = JSON.stringify(uiInputValues(block, new UiState(block)));
    const initial = frozen && frozen.revision === block.revision ? frozen.readings : {};
    const successfulFor = (name: string, signature: string): ChatUiQueryReading | undefined => {
        const local = readings[name];
        if (local?.identity === identity && local.successful?.inputs === signature) {
            return local.successful.reading;
        }
        return signature === defaultInputs && initial[name]?.state === 'fresh' ? initial[name] : undefined;
    };
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
    const query = chatHost().intelligentUi?.query;
    const subscribe = chatHost().intelligentUi?.subscribe;
    useEffect(() => {
        const scope = state.scope();
        for (const name of names) {
            const successful = successfulFor(name, inputs);
            if (successful && JSON.stringify(scope[name]) !== JSON.stringify(successful.value)) {
                state.setQuery(name, successful.value, block);
            }
        }
    });
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
        const refresh = async () => {
            if (stopped || !visible || !documentVisible() || busy) {
                return;
            }
            const wait = lastReadAt.current.identity === identity ? UI_HOST_LIMITS.refreshMilliseconds - (Date.now() - lastReadAt.current.at) : 0;
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
            lastReadAt.current = { identity, at: Date.now() };
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
                    setReadings((previous) => ({
                        ...previous,
                        [name]: {
                            identity,
                            reading,
                            successful:
                                reading.state === 'fresh' ? { inputs, reading } : previous[name]?.identity === identity ? previous[name].successful : undefined
                        }
                    }));
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
            observer?.disconnect();
            unsubscribe?.();
            document.removeEventListener('visibilitychange', focus);
            if (timer !== null) {
                clearTimeout(timer);
            }
        };
    }, [block, state, context.scopeId, context.chatId, context.itemId, context.phase, inputs, query, subscribe, element, identity, inputKey]);
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
              readAt: Object.values(currentReadings)
                  .filter((reading) => reading.state === 'fresh')
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
    const dependencies = new Map<string, Set<string>>();
    const names = new Set(Object.keys(block.queries));
    const references = (value: unknown, into: Set<string>) => {
        if (!value || typeof value !== 'object') {
            return;
        }
        const expression = value as Record<string, unknown>;
        if (expression.kind === 'reference' && names.has(String(expression.name))) {
            into.add(String(expression.name));
        }
        for (const child of Object.values(expression)) {
            if (Array.isArray(child)) {
                child.forEach((item) => references(item, into));
            } else if (typeof child === 'object') {
                references(child, into);
            }
        }
    };
    const written = (nodes: readonly UiNode[], inherited = new Set<string>()) => {
        for (const node of nodes) {
            const related = new Set(inherited);
            references(node.expressions, related);
            dependencies.set(node.id, related);
            written(node.children, node.type === 'Each' ? related : inherited);
        }
    };
    written(block.nodes);
    const values = new Map<string, Record<string, unknown>>();
    const sources = new Map<string, Set<string>>();
    const collect = (nodes: readonly UiViewNode[]) => {
        for (const node of nodes) {
            const related = dependencies.get(node.sourceId ?? node.id);
            if (related?.size && !node.error) {
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
        return undefined;
    }
    return (id: string, prop: string, path?: readonly [number, string]): UiLiveValue | undefined => {
        const related = sources.get(id);
        if (!related) {
            return undefined;
        }
        const get = (props?: Record<string, unknown>): unknown => {
            const value = props?.[prop];
            return path && Array.isArray(value) ? value[path[0]]?.[path[1]] : value;
        };
        const before = get(previous.get(id));
        const value = get(values.get(id));
        return {
            previous: before,
            changed: before !== undefined && JSON.stringify(before) !== JSON.stringify(value),
            stale: [...related].some((name) => readings[name]?.state === 'failed' || readings[name]?.state === 'refused')
        };
    };
}
