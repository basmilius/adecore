import type { ChatUiDiffPayload, ChatUiDiffReading } from '@adecore/agent-contracts';
import { uiInputValues, type UiBlock, type UiProps, type UiState, type UiViewNode } from '@adecore/intelligent-ui';
import { useEffect, useRef, useState } from 'react';
import { useChatHost } from '../../../host/host';
import type { UiDiff, UiRenderContext } from './render-context';

/* The open Diffs one block asks its host for; a Diff past these stays a chip, so no block reads a whole repository. */
export const UI_OPEN_DIFFS = 8;

/* What a node asks to see. Only its id goes to the host, which reads the rest from the stored block; here it tells one request from the next. */
type DiffRequest = Pick<ChatUiDiffPayload, 'nodeId'> & Pick<UiProps<'Diff'>, 'path' | 'from' | 'to' | 'whitespace'>;

interface DiffState {
    /* The request the reading answers, so one for a path the node has since left is not shown. */
    request: string;
    diff: UiDiff;
}

function openDiffs(nodes: readonly UiViewNode[], into: DiffRequest[] = []): DiffRequest[] {
    for (const node of nodes) {
        if (node.type === 'Diff' && node.error === undefined && node.complete) {
            const { path, open, from, to, whitespace } = node.props as UiProps<'Diff'>;

            if (open === true) {
                into.push({ nodeId: node.id, path, from, to, whitespace });
            }
        }

        openDiffs(node.children, into);
    }

    return into;
}

function diffOf(reading: ChatUiDiffReading): UiDiff {
    return reading.state === 'patch' && reading.patch !== undefined
        ? { state: 'patch', patch: reading.patch, truncated: reading.truncated === true }
        : { state: 'refused', code: reading.code, reason: reading.reason };
}

/*
 * Asks the host for the change of every open Diff of a finished block, once per request. The agent
 * writes only the path, so what is shown is what git holds and never what a model copied.
 */
export function useUiDiffs(
    block: UiBlock,
    state: UiState,
    context: Pick<UiRenderContext, 'scopeId' | 'chatId' | 'itemId' | 'phase'>,
    reads: Readonly<Record<string, string>>,
    nodes: readonly UiViewNode[]
): UiRenderContext['diff'] {
    const [answered, setAnswered] = useState<Record<string, DiffState>>({});
    // What each node was last asked as, so a redraw asks nothing twice.
    const asked = useRef(new Map<string, string>());
    const read = useChatHost().intelligentUi?.diff;
    const wanted = block.complete ? openDiffs(nodes).slice(0, UI_OPEN_DIFFS) : [];
    const signature = JSON.stringify(wanted);
    const input = JSON.stringify(uiInputValues(block, state));
    const tickets = JSON.stringify(reads);
    const ready = read !== undefined && block.revision !== undefined && context.phase === 'final';

    useEffect(() => {
        const requests = asked.current;

        return () => requests.clear();
    }, [block.id, block.revision, context.scopeId, context.chatId, context.itemId, read]);

    useEffect(() => {
        if (!read || !block.revision || context.phase !== 'final') {
            return;
        }

        for (const request of JSON.parse(signature) as DiffRequest[]) {
            const key = JSON.stringify(request);

            if (asked.current.get(request.nodeId) === key) {
                continue;
            }

            asked.current.set(request.nodeId, key);

            const record = (diff: UiDiff): void => {
                // An answer to a request the node has left, or of a block that is gone, is dropped.
                if (asked.current.get(request.nodeId) === key) {
                    setAnswered((previous) => ({ ...previous, [request.nodeId]: { request: key, diff } }));
                }
            };

            read(context.scopeId, {
                chatId: context.chatId,
                itemId: context.itemId,
                blockId: block.id,
                revision: block.revision,
                nodeId: request.nodeId,
                values: JSON.parse(input),
                reads: JSON.parse(tickets)
            }).then(
                (reading) => record(diffOf(reading)),
                () => record({ state: 'refused' })
            );
        }
    }, [block.id, block.revision, context.scopeId, context.chatId, context.itemId, context.phase, signature, input, tickets, read]);

    if (!read) {
        return undefined;
    }

    return (nodeId) => {
        const request = wanted.find((entry) => entry.nodeId === nodeId);

        if (request === undefined || !ready) {
            return undefined;
        }

        const reading = answered[nodeId];

        return reading?.request === JSON.stringify(request) ? reading.diff : { state: 'reading' };
    };
}
