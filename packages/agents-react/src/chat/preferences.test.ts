import { describe, expect, test } from 'bun:test';
import type { ModelSelection, ProviderAccounts } from '@adecore/agent-contracts';
import {
    chatPreferencesPayload,
    DEFAULT_CHAT_PREFERENCES,
    defaultProvider,
    favoriteModelsOf,
    parseChatPreferences,
    selectionFor,
    startingSelection,
    withFavoriteToggled,
    withSelection,
    type ChatPreferences
} from './preferences';

const sonnet: ModelSelection = { model: 'claude-sonnet-5', options: { effort: 'high' } };
const gpt: ModelSelection = { model: 'gpt-5-codex', options: {} };

function preferences(patch: Partial<ChatPreferences> = {}): ChatPreferences {
    return { ...DEFAULT_CHAT_PREFERENCES, ...patch };
}

describe('selectionByProvider', () => {
    test('a pick lands in its own provider and leaves the others alone', () => {
        const first = withSelection(preferences(), 'claude', sonnet);
        const second = withSelection(first, 'codex', gpt);
        expect(second.selectionByProvider).toEqual({ claude: sonnet, codex: gpt });
    });

    test('the last pick is the global default', () => {
        const after = withSelection(withSelection(preferences(), 'claude', sonnet), 'codex', gpt);
        expect(defaultProvider(after)).toBe('codex');
        expect(defaultProvider(withSelection(after, 'claude', sonnet))).toBe('claude');
    });

    test('nothing remembered means no default provider and no selection', () => {
        expect(defaultProvider(preferences())).toBeNull();
        expect(selectionFor(preferences(), null)).toBeNull();
        expect(selectionFor(preferences(), 'claude')).toBeNull();
    });
});

describe('the default chain', () => {
    const remembered = preferences({ selectionByProvider: { claude: sonnet, codex: gpt }, lastProvider: 'codex' });

    test('a named provider takes its own model, never the global default', () => {
        expect(selectionFor(remembered, 'claude')).toEqual(sonnet);
    });

    test('without a provider the last used one answers', () => {
        expect(selectionFor(remembered, null)).toEqual(gpt);
        expect(selectionFor(remembered, undefined)).toEqual(gpt);
    });

    test('a provider that was never picked for falls through to the host', () => {
        expect(selectionFor(remembered, 'gemini')).toBeNull();
    });
});

describe('reading what is stored', () => {
    test('an empty store is the defaults', () => {
        expect(parseChatPreferences(null)).toEqual(DEFAULT_CHAT_PREFERENCES);
    });

    test('unreadable JSON is the defaults', () => {
        expect(parseChatPreferences('{ not json')).toEqual(DEFAULT_CHAT_PREFERENCES);
    });

    test('the older global selection and the plan toggle are dropped', () => {
        const parsed = parseChatPreferences(JSON.stringify({ selection: sonnet, interactionMode: 'plan', runtimeMode: 'supervised' }));
        expect(parsed).toEqual(preferences({ runtimeMode: 'supervised' }));
    });

    test('what is stored wins over the defaults', () => {
        const stored = {
            selectionByProvider: { claude: sonnet },
            lastProvider: 'claude',
            runtimeMode: 'auto',
            terminalRuntimeMode: 'supervised',
            readingWidth: 'narrow',
            sendKey: 'mod-enter',
            favoriteModels: { claude: ['opus'], codex: ['gpt-5-codex', 'gpt-5'] },
            changedAt: 42
        };

        expect(parseChatPreferences(JSON.stringify(stored))).toEqual(stored as ChatPreferences);
    });

    test('a reading width this build does not know is the default one', () => {
        expect(parseChatPreferences(JSON.stringify({ readingWidth: 'wide' })).readingWidth).toBe('comfortable');
        expect(parseChatPreferences(JSON.stringify({ readingWidth: 'full' })).readingWidth).toBe('full');
    });

    test('a send key this build does not know is Enter', () => {
        expect(parseChatPreferences(JSON.stringify({ sendKey: 'shift-enter' })).sendKey).toBe('enter');
        expect(parseChatPreferences(JSON.stringify({ sendKey: 'mod-enter-multiline' })).sendKey).toBe('mod-enter-multiline');
    });

    test('preferences written before the moment of a change was kept count as the oldest pick', () => {
        expect(parseChatPreferences(JSON.stringify({ runtimeMode: 'auto' })).changedAt).toBe(0);
    });
});

describe('what a machine is told', () => {
    test('the modes, a model per provider and the moment of the last change', () => {
        const remembered = preferences({
            selectionByProvider: { claude: sonnet, codex: gpt },
            lastProvider: 'codex',
            runtimeMode: 'supervised',
            terminalRuntimeMode: 'auto',
            changedAt: 7
        });

        // The terminal mode too, since the machine starts terminal agents a verb opened on its own.
        expect(chatPreferencesPayload(remembered)).toEqual({
            runtimeMode: 'supervised',
            terminalRuntimeMode: 'auto',
            selections: { claude: sonnet, codex: gpt },
            changedAt: 7
        });
    });

    test('the top account of each CLI that is not its default, for a machine that still reads them', () => {
        const accounts: ProviderAccounts = {
            accounts: {
                claude: { kind: 'claude', order: 1 },
                claude_work: { kind: 'claude', order: 0 },
                codex: { kind: 'codex' },
                codex_client: { kind: 'codex' }
            },
            statuses: []
        };

        expect(chatPreferencesPayload(preferences(), accounts).accounts).toEqual({ claude: 'claude_work' });
        expect(chatPreferencesPayload(preferences(), null).accounts).toBeUndefined();
        expect(chatPreferencesPayload(preferences()).accounts).toBeUndefined();
    });
});

test('each provider starts with its remembered model or its own catalog default', () => {
    const picked = withSelection(preferences(), 'claude', { model: 'sonnet', options: { effort: 'high' } });
    const claude = { kind: 'claude', defaultModel: 'opus' } as import('@adecore/agent-contracts').ProviderInfo;
    const codex = { kind: 'codex', defaultModel: 'gpt' } as import('@adecore/agent-contracts').ProviderInfo;
    expect(startingSelection(picked, claude)).toEqual({ model: 'sonnet', options: { effort: 'high' } });
    expect(startingSelection(picked, codex)).toEqual({ model: 'gpt', options: {} });
    expect(startingSelection(picked, { ...codex, defaultModel: null })).toBeNull();
});

describe('favoriteModels', () => {
    test('a star goes on a model of its own CLI and comes off again, and a CLI with none left drops out', () => {
        const starred = withFavoriteToggled(withFavoriteToggled(preferences(), 'claude', 'opus'), 'codex', 'gpt-5-codex');
        expect(favoriteModelsOf(starred.favoriteModels, 'claude')).toEqual(new Set(['opus']));
        expect(favoriteModelsOf(starred.favoriteModels, 'codex')).toEqual(new Set(['gpt-5-codex']));
        const unstarred = withFavoriteToggled(starred, 'claude', 'opus');
        expect(unstarred.favoriteModels).toEqual({ codex: ['gpt-5-codex'] });
        expect(favoriteModelsOf(unstarred.favoriteModels, 'claude').size).toBe(0);
    });

    test('a star is no pick a machine weighs, so it leaves the moment of the last change alone', () => {
        expect(withFavoriteToggled(preferences({ changedAt: 7 }), 'claude', 'opus').changedAt).toBe(7);
    });

    test('only lists of slugs are read back', () => {
        const parsed = parseChatPreferences(JSON.stringify({ favoriteModels: { claude: ['opus', 3, ''], codex: 'gpt-5', grok: [] } }));
        expect(parsed.favoriteModels).toEqual({ claude: ['opus'] });
        expect(parseChatPreferences(JSON.stringify({ favoriteModels: ['opus'] })).favoriteModels).toEqual({});
    });
});
