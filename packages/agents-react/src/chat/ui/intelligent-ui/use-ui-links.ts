import { useEffect, useState } from 'react';
import type { ChatUiLinkReading, ChatUiQueryState } from '@adecore/agent-contracts';
import { uiLinkTargets, type UiLinkTarget } from '@adecore/intelligent-ui/links';
import { uiInputValues, UI_HOST_LIMITS, type UiBlock, UiState } from '@adecore/intelligent-ui';
import { chatHost } from '../../../host';
import type { UiRenderContext } from './render-context';

interface LinkState {
    target: string;
    reading: ChatUiLinkReading;
}

export function useUiLinks(
    block: UiBlock,
    state: UiState,
    context: UiRenderContext,
    reads: Readonly<Record<string, string>>,
    frozen?: ChatUiQueryState['blocks'][string]
) {
    const [checked, setChecked] = useState<Record<string, LinkState>>({});
    const host = chatHost().intelligentUi;
    const values = uiInputValues(block, state);
    const scope = state.scope();
    const queryValues = Object.fromEntries(
        Object.keys(block.queries)
            .filter((name) => Object.hasOwn(scope, name))
            .map((name) => [name, scope[name]])
    );
    let targets: Record<string, UiLinkTarget> = {};
    try {
        if (block.complete) {
            targets = uiLinkTargets(block, values, queryValues);
        }
    } catch {}
    const signature = JSON.stringify(targets);
    const input = JSON.stringify(values);
    const tickets = JSON.stringify(reads);
    const link = host?.link;
    useEffect(() => {
        if (!link || !block.revision || context.phase !== 'final') {
            return;
        }
        let stopped = false;
        const validate = async () => {
            for (const [nodeId, target] of Object.entries(JSON.parse(signature) as Record<string, UiLinkTarget>).slice(0, UI_HOST_LIMITS.links)) {
                try {
                    const reading = await link(context.scopeId, {
                        chatId: context.chatId,
                        itemId: context.itemId,
                        blockId: block.id,
                        revision: block.revision!,
                        nodeId,
                        values: JSON.parse(input),
                        reads: JSON.parse(tickets)
                    });
                    if (stopped) {
                        return;
                    }
                    setChecked((previous) => ({ ...previous, [nodeId]: { target: JSON.stringify(target), reading } }));
                } catch {
                    if (stopped) {
                        return;
                    }
                    setChecked((previous) => ({ ...previous, [nodeId]: { target: JSON.stringify(target), reading: { state: 'plain' } } }));
                }
            }
        };
        void validate();
        return () => {
            stopped = true;
        };
    }, [block.id, block.revision, context.scopeId, context.chatId, context.itemId, context.phase, signature, input, tickets, link]);
    const idOf = (target: UiLinkTarget) => Object.entries(targets).find(([, entry]) => JSON.stringify(entry) === JSON.stringify(target))?.[0];
    const resolution = (target: UiLinkTarget): ChatUiLinkReading => {
        const id = idOf(target);
        if (id === undefined) {
            return { state: 'plain' };
        }
        if (checked[id]?.target === JSON.stringify(target)) {
            return checked[id].reading;
        }
        if (input === JSON.stringify(uiInputValues(block, new UiState(block))) && frozen && frozen.revision === block.revision) {
            const firstQueries = Object.fromEntries(
                Object.entries(frozen.readings)
                    .filter(([, reading]) => reading.state === 'fresh')
                    .map(([name, reading]) => [name, reading.value])
            );
            if (JSON.stringify(queryValues) === JSON.stringify(firstQueries)) {
                return frozen.links?.[id] ?? { state: 'plain' };
            }
        }
        return { state: 'plain' };
    };
    const open = (target: UiLinkTarget) => {
        const nodeId = idOf(target);
        if (!nodeId || !link || !block.revision) {
            return;
        }
        void link(context.scopeId, {
            chatId: context.chatId,
            itemId: context.itemId,
            blockId: block.id,
            revision: block.revision,
            nodeId,
            values,
            reads: { ...reads }
        })
            .then((reading) => {
                setChecked((previous) => ({ ...previous, [nodeId]: { target: JSON.stringify(target), reading } }));
                if (reading.state === 'chip' && reading.target) {
                    host?.openLink?.(context.scopeId, reading);
                }
            })
            .catch(() => {
                setChecked((previous) => ({ ...previous, [nodeId]: { target: JSON.stringify(target), reading: { state: 'plain' } } }));
            });
    };
    return {
        link: link ? resolution : context.link,
        openLink: link && host?.openLink ? open : context.openLink,
        openUrl: host?.openUrl ? (url: string) => host.openUrl!(context.scopeId, url) : context.openUrl
    };
}
