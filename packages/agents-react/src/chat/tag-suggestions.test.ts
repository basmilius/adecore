import { describe, expect, test } from 'bun:test';
import type { AgentKind, ModelInfo, ProviderAccounts, ProviderAccountState, ProviderInfo } from '@adecore/agent-contracts';
import { accountSuggestions, modelSuggestions, signedIn, startsAWord } from './tag-suggestions';

const model = (slug: string, name: string, extra: Partial<ModelInfo> = {}): ModelInfo => ({
    slug,
    name,
    legacy: false,
    isDefault: false,
    options: [],
    ...extra
});

const provider = (kind: AgentKind, models: ModelInfo[], extra: Partial<ProviderInfo> = {}): ProviderInfo =>
    ({
        kind,
        name: kind === 'claude' ? 'Claude Code' : 'Codex',
        version: '2.0.0',
        installed: true,
        capabilities: { chat: true },
        models,
        ...extra
    }) as ProviderInfo;

const accountsWith = (states: Record<string, ProviderAccountState>, labels: Record<string, string> = {}): ProviderAccounts => ({
    accounts: Object.fromEntries(Object.keys(states).map((id) => [id, { kind: id.split('_')[0]!, label: labels[id] }])),
    statuses: Object.entries(states).map(([id, state]) => ({
        id,
        kind: id.split('_')[0]!,
        state,
        email: null,
        plan: null,
        organization: null,
        home: '',
        message: null,
        checkedAt: 1
    }))
});

const none = (): ReadonlySet<string> => new Set();

describe('startsAWord', () => {
    test('matches the start of a word in the name or the id, never the middle', () => {
        expect(startsAWord('Opus 5.5', 'op')).toBe(true);
        expect(startsAWord('claude-opus-5-5', 'opus-5')).toBe(true);
        expect(startsAWord('Opus 5.5', 'pus')).toBe(false);
        expect(startsAWord('Opus 5.5', '')).toBe(false);
    });
});

describe('modelSuggestions', () => {
    const opus = model('claude-opus-5-5', 'Opus 5.5');
    const old = model('claude-opus-4', 'Opus 4', { legacy: true });

    test('offers nothing on a bare @, and nothing by the vendor alone', () => {
        const providers = [provider('codex', [model('gpt-5', 'GPT-5', { vendor: 'OpenAI' })])];

        expect(modelSuggestions(providers, null, '', none)).toEqual([]);
        expect(modelSuggestions(providers, null, 'open', none)).toEqual([]);
    });

    test('puts legacy models last', () => {
        const found = modelSuggestions([provider('claude', [old, opus])], null, 'op', none);

        expect(found.map((entry) => entry.id)).toEqual(['claude-opus-5-5', 'claude-opus-4']);
        expect(found[0]).toMatchObject({ kind: 'model', cli: 'claude' });
    });

    test('leaves out a CLI that is not installed or does not chat, and a model the CLI is too old for', () => {
        const providers = [
            provider('claude', [opus], { installed: false }),
            provider('codex', [model('gpt-9', 'GPT-9', { minCliVersion: '9.0' }), model('gpt-5', 'GPT-5')])
        ];

        expect(modelSuggestions(providers, null, 'gpt', none).map((entry) => entry.id)).toEqual(['gpt-5']);
        expect(modelSuggestions([provider('claude', [opus], { capabilities: { chat: false } } as Partial<ProviderInfo>)], null, 'op', none)).toEqual([]);
    });

    test('offers a model the CLI already reported running, whatever its version says', () => {
        const blocked = model('gpt-9', 'GPT-9', { minCliVersion: '9.0' });

        expect(modelSuggestions([provider('codex', [blocked])], null, 'gpt', () => new Set(['gpt-9']))).toHaveLength(1);
    });

    test('stops at eight', () => {
        const many = Array.from({ length: 10 }, (_, i) => model(`opus-${i}`, `Opus ${i}`));

        expect(modelSuggestions([provider('claude', many)], null, 'op', none)).toHaveLength(8);
    });
});

describe('modelSuggestions on accounts', () => {
    const opus = model('claude-opus-5-5', 'Opus 5.5');
    const sonnet = model('claude-sonnet-5-5', 'Sonnet 5.5');
    const providers = [provider('claude', [opus, sonnet])];
    const accounts = accountsWith({ claude: 'ready', claude_work: 'ready' }, { claude_work: 'Work' });
    const rows = (found: ReturnType<typeof modelSuggestions>): string[] => found.map((entry) => `${entry.accountName ?? '-'} / ${entry.id}`);

    test('offers a row per ready account, the chat own account first', () => {
        const found = modelSuggestions(providers, accounts, 'op', none, null, { provider: 'claude', account: 'claude_work' });

        expect(rows(found)).toEqual(['Work / claude-opus-5-5', 'Claude Code / claude-opus-5-5']);
        expect(found[0]).toMatchObject({ kind: 'model', cli: 'claude', account: 'claude_work' });
    });

    test('finds every model of an account by its name, and narrows with a slash', () => {
        expect(rows(modelSuggestions(providers, accounts, 'wo', none))).toEqual(['Work / claude-opus-5-5', 'Work / claude-sonnet-5-5']);
        expect(rows(modelSuggestions(providers, accounts, 'wo/so', none))).toEqual(['Work / claude-sonnet-5-5']);
    });

    test('keeps the model alone while fewer than two accounts are ready and offered', () => {
        const signedOut = accountsWith({ claude: 'ready', claude_work: 'signed-out' }, { claude_work: 'Work' });

        expect(rows(modelSuggestions(providers, signedOut, 'op', none))).toEqual(['- / claude-opus-5-5']);
        expect(rows(modelSuggestions(providers, accounts, 'op', none, { claude: { off: ['claude_work'] } }))).toEqual(['- / claude-opus-5-5']);
        expect(modelSuggestions(providers, signedOut, 'wo', none)).toEqual([]);
    });
});

describe('signedIn', () => {
    test('counts a CLI without accounts, and one with an enabled account that may run', () => {
        expect(signedIn(null, 'claude')).toBe(true);

        for (const state of ['ready', 'checking', 'unavailable'] as const) {
            expect(signedIn(accountsWith({ claude: state }), 'claude')).toBe(true);
        }
    });

    test('leaves out a CLI whose every account is signed out, missing, without its folder or failed', () => {
        for (const state of ['signed-out', 'not-found', 'folder-missing', 'failed'] as const) {
            expect(signedIn(accountsWith({ claude: state }), 'claude')).toBe(false);
        }

        expect(signedIn(accountsWith({ claude: 'signed-out', claude_work: 'ready' }), 'claude')).toBe(true);
    });

    test('leaves out an account that is turned off', () => {
        const accounts = accountsWith({ claude: 'ready' });
        accounts.accounts.claude!.enabled = false;

        expect(signedIn(accounts, 'claude')).toBe(false);
    });
});

describe('accountSuggestions', () => {
    const providers = [provider('codex', [])];

    test('offers a ready account by its name, once the CLI has a choice', () => {
        const accounts = accountsWith({ codex: 'ready', codex_work: 'ready', codex_home: 'signed-out' }, { codex_work: 'Work', codex_home: 'Home' });

        expect(accountSuggestions(providers, accounts, null, 'wo').map((entry) => entry.id)).toEqual(['codex_work']);
        expect(accountSuggestions(providers, accounts, null, 'ho')).toEqual([]);
        expect(accountSuggestions(providers, accountsWith({ codex: 'ready' }), null, 'co')).toEqual([]);
    });

    test('leaves out an account the project turned off', () => {
        const accounts = accountsWith({ codex: 'ready', codex_work: 'ready' }, { codex_work: 'Work' });

        expect(accountSuggestions(providers, accounts, { codex: { off: ['codex_work'] } }, 'wo')).toEqual([]);
    });
});
