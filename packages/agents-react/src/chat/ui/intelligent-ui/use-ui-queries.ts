import { useEffect, useRef, useState } from 'react';
import type { ChatUiQueryReading, ChatUiQueryState } from '@adecore/agent-contracts';
import { uiInputValues, type UiBlock, type UiState } from '@adecore/intelligent-ui';
import { chatHost } from '../../../host';
import type { UiLiveStatus, UiRenderContext } from './render-context';

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
    const [readings, setReadings] = useState<Record<string, ChatUiQueryReading>>({});
    const [reading, setReading] = useState(false);
    const lastReadAt = useRef(0);
    const names = Object.keys(block.queries);
    const inputs = JSON.stringify(uiInputValues(block, state));
    const query = chatHost().intelligentUi?.query;
    const subscribe = chatHost().intelligentUi?.subscribe;
    useEffect(() => {
        if (!frozen || frozen.revision !== block.revision) {
            return;
        }
        for (const [name, reading] of Object.entries(frozen.readings)) {
            if (reading.state === 'fresh' && Object.hasOwn(block.queries, name)) {
                state.setQuery(name, reading.value, block);
            }
        }
    }, [frozen, block, state]);
    useEffect(() => {
        if (!query || !block.complete || !block.revision || !Object.keys(block.queries).length || context.phase !== 'final') {
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
            const wait = 10_000 - (Date.now() - lastReadAt.current);
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
            lastReadAt.current = Date.now();
            setReading(true);
            for (const name of Object.keys(block.queries).slice(0, 8)) {
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
                    setReadings((previous) => ({ ...previous, [name]: reading }));
                } catch (error) {
                    if (stopped) {
                        return;
                    }
                    setReadings((previous) => ({
                        ...previous,
                        [name]: { state: 'failed', readAt: Date.now(), reason: error instanceof Error ? error.message : 'This query could not be read.' }
                    }));
                }
            }
            busy = false;
            if (stopped) {
                return;
            }
            setReading(false);
            timer = setTimeout(() => {
                timer = null;
                void refresh();
            }, 10_000);
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
    }, [block, state, context.scopeId, context.chatId, context.itemId, context.phase, inputs, query, subscribe, element]);
    const currentReadings = { ...(frozen?.revision === block.revision ? frozen?.readings : {}), ...readings };
    const failed = Object.entries(currentReadings).find(([, value]) => value.state !== 'fresh');
    const live: UiLiveStatus | undefined = names.length
        ? {
              state: reading ? 'reading' : (failed?.[1].state ?? 'fresh'),
              sources: names.map((name) => block.queries[name].source),
              readAt: Object.values(currentReadings)
                  .filter((reading) => reading.state === 'fresh')
                  .reduce<number | null>((at, value) => (at === null ? value.readAt : Math.min(at, value.readAt)), null),
              source: failed ? block.queries[failed[0]]?.source : undefined,
              reason: failed?.[1].reason
          }
        : undefined;
    const reads = Object.fromEntries(
        Object.entries(currentReadings)
            .filter(([, reading]) => reading.state === 'fresh' && reading.readId)
            .map(([name, reading]) => [name, reading.readId!])
    );
    return { live, reads, reading };
}
