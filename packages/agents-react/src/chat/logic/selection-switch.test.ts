import { describe, expect, test } from 'bun:test';
import type { ModelInfo, ModelSelection } from '@adecore/agent-contracts';
import type { ChatThreadItem } from '../../chat-sink';
import { selectionSwitchText } from './selection-switch';
import { deriveTimelineRows } from './timeline';

const effort = {
    id: 'effort',
    label: 'Reasoning',
    type: 'select' as const,
    defaultChoice: 'medium',
    choices: [
        { id: 'low', label: 'Low' },
        { id: 'medium', label: 'Medium' },
        { id: 'xhigh', label: 'Extra High' }
    ]
};

const models: ModelInfo[] = [
    { slug: 'opus', name: 'Claude Opus 5.5', legacy: false, isDefault: true, options: [effort] },
    { slug: 'sonnet', name: 'Claude Sonnet 5.5', legacy: false, isDefault: false, options: [effort] },
    { slug: 'haiku', name: 'Claude Haiku 5.5', legacy: false, isDefault: false, options: [] }
];

const pick = (model: string, level?: string): ModelSelection => ({ model, options: level === undefined ? {} : { effort: level } });

describe('selectionSwitchText', () => {
    test('names only the effort when the model stayed', () => {
        expect(selectionSwitchText(pick('opus', 'low'), pick('opus', 'xhigh'), models)).toEqual({ from: 'Low', to: 'Extra High' });
    });

    test('names only the models when the effort stayed, without the words every model shares', () => {
        expect(selectionSwitchText(pick('opus', 'low'), pick('sonnet', 'low'), models)).toEqual({ from: 'Opus 5.5', to: 'Sonnet 5.5' });
    });

    test('names both when both changed, and no effort for a model without one', () => {
        expect(selectionSwitchText(pick('opus', 'xhigh'), pick('sonnet', 'medium'), models)).toEqual({ from: 'Opus 5.5 Extra High', to: 'Sonnet 5.5 Medium' });
        expect(selectionSwitchText(pick('haiku'), pick('opus', 'low'), models)).toEqual({ from: 'Haiku 5.5', to: 'Opus 5.5 Low' });
    });

    test('says nothing when an unset effort meets its own default', () => {
        expect(selectionSwitchText(pick('opus'), pick('opus', 'medium'), models)).toBeNull();
    });
});

describe('the line between turns', () => {
    const turn = (id: string, selection?: ModelSelection): ChatThreadItem[] => [
        { id, kind: 'turn', createdAt: 1, turnId: id, state: 'done', endedAt: 2, costUsd: 0, ...(selection === undefined ? {} : { selection }) },
        { id: `u-${id}`, kind: 'user', createdAt: 1, turnId: id, text: 'hi' },
        { id: `a-${id}`, kind: 'assistant', createdAt: 2, turnId: id, text: 'hi', streaming: false }
    ];

    const options = { expandedGroups: new Set<string>(), expandedTurns: new Set<string>(), expandedSubagents: new Set<string>(), activeTurnId: null };

    const switches = (items: ChatThreadItem[]) =>
        deriveTimelineRows(items, options)
            .filter((row) => row.kind === 'selection-switch')
            .map((row) => row.id);

    test('stands above a turn that ran on another selection than the one before it', () => {
        const items = [...turn('t1', pick('opus', 'low')), ...turn('t2', pick('opus', 'low')), ...turn('t3', pick('sonnet', 'low'))];
        const rows = deriveTimelineRows(items, options);

        expect(switches(items)).toEqual(['switch-t3']);
        expect(rows[rows.findIndex((row) => row.kind === 'selection-switch') + 1]).toMatchObject({ kind: 'user', id: 'u-t3' });
    });

    test('skips a turn without a selection and compares across it', () => {
        expect(switches([...turn('t1'), ...turn('t2', pick('opus', 'low'))])).toEqual([]);
        expect(switches([...turn('t1', pick('opus', 'low')), ...turn('t2'), ...turn('t3', pick('opus', 'xhigh'))])).toEqual(['switch-t3']);
    });

    test('ignores options other than the effort', () => {
        expect(switches([...turn('t1', { model: 'opus', options: { fast: false } }), ...turn('t2', { model: 'opus', options: { fast: true } })])).toEqual([]);
    });
});
