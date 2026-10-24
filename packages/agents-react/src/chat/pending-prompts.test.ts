import { afterEach, expect, test } from 'bun:test';
import type { ChatInfo, ChatSubagentItem } from '@adecore/agent-contracts';
import type { PromptSubject } from '../prompts/logic/subjects';
import type { ChatScope } from '../scope';
import { useChats } from '../state/chats';
import { PROMPT_SAMPLES } from '../testing/prompts';
import { ChatPromptFeed } from './pending-prompts';

const APPROVAL = PROMPT_SAMPLES.find((sample) => sample.label === 'Permission · Command')!.items[0]!;
const keyOf = (id: string) => `prompt-feed/${id}`;
const info = (chatId: string, waiting = true): ChatInfo => ({ chatId, provider: 'grok', status: waiting ? 'needs-you' : 'running' }) as ChatInfo;
const child = (childId: string): ChatSubagentItem =>
    ({ kind: 'subagent', id: `spawn-${childId}`, childId, description: childId, status: 'running' }) as ChatSubagentItem;
const cleanups: Array<() => void> = [];

afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
        cleanup();
    }
    useChats.getState().forgetWhere((key) => key.startsWith('prompt-feed/') || key.startsWith('other-feed/'));
});

function follow() {
    const held: string[] = [];
    const released: string[] = [];
    let subjects: PromptSubject[] = [];
    const scope = {
        keyOf,
        chats: {
            observe: (id: string) => {
                held.push(id);
                return () => {
                    released.push(id);
                };
            }
        }
    } as unknown as ChatScope;
    const feed = new ChatPromptFeed(scope, 'main', (next) => {
        subjects = next;
    });
    cleanups.push(() => feed.dispose());
    feed.start();
    return { feed, held, released, subjects: () => subjects };
}

test('follows later descendants and paged requests, keeps their recipients apart, and ignores other scopes', () => {
    useChats.getState().reset(keyOf('main'), info('main'), [APPROVAL, child('first')]);
    const following = follow();
    expect(following.held).toEqual(['first']);
    expect(following.subjects()).toEqual([{ kind: 'chat', nodeId: 'main', item: APPROVAL }]);

    useChats
        .getState()
        .reset(keyOf('first'), info('first'), [], { history: { start: 20, cursor: 'older' }, pending: [APPROVAL], subagents: [child('nested')] });
    useChats.getState().reset('other-feed/nested', info('nested'), [APPROVAL]);
    expect(following.held).toEqual(['first', 'nested']);
    expect(following.subjects()).toHaveLength(2);
    useChats.getState().reset(keyOf('nested'), info('nested'), [APPROVAL]);
    expect(following.subjects()).toEqual([
        { kind: 'chat', nodeId: 'main', item: APPROVAL },
        { kind: 'chat', nodeId: 'first', item: APPROVAL, source: { label: 'first', provider: 'grok' } },
        { kind: 'chat', nodeId: 'nested', item: APPROVAL, source: { label: 'nested', provider: 'grok' } }
    ]);

    useChats.getState().status(keyOf('nested'), info('nested', false));
    expect(following.subjects().map((subject) => subject.nodeId)).toEqual(['main', 'first']);
    following.feed.dispose();
    expect(following.released).toEqual(['first', 'nested']);
});

test('discovers a child created in a streamed event and releases a settled branch', () => {
    useChats.getState().reset(keyOf('main'), info('main', false), []);
    const following = follow();
    useChats.getState().apply(keyOf('main'), { type: 'item', item: child('later') });
    expect(following.held).toEqual(['later']);
    useChats.getState().reset(keyOf('later'), info('later'), [APPROVAL]);
    expect(following.subjects().map((subject) => subject.nodeId)).toEqual(['later']);
    useChats.getState().status(keyOf('later'), info('later', false));
    useChats.getState().apply(keyOf('main'), { type: 'item', item: { ...child('later'), status: 'done' } });
    expect(following.subjects()).toEqual([]);
    expect(following.released).toEqual(['later']);
});
