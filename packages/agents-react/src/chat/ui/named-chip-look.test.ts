import { describe, expect, test } from 'bun:test';
import type { ProviderAccounts, ProviderInfo } from '@adecore/agent-contracts';
import { namedChipLookup } from './named-chip-look';

const providers = [
    {
        kind: 'claude',
        name: 'Claude Code',
        models: [{ slug: 'claude-haiku-5-5', name: 'Haiku 5.5', legacy: false, isDefault: false, options: [] }]
    }
] as unknown as ProviderInfo[];

const accounts: ProviderAccounts = {
    accounts: { claude: { kind: 'claude', color: 'teal' }, claude_work: { kind: 'claude', label: 'Work', color: 'rose' } },
    statuses: []
};

const accents = [
    { id: 'teal', color: '#0aa' },
    { id: 'rose', color: '#e46' }
] as never;

describe('namedChipLookup', () => {
    test('names a model as the catalog does, in the color of the account a child would inherit', () => {
        const lookup = namedChipLookup(providers, accounts, accents, { provider: 'claude', account: 'claude_work' });

        expect(lookup('model', 'claude', 'claude-haiku-5-5')).toEqual({ label: 'Haiku 5.5', color: '#e46' });
    });

    test('takes the account a new chat starts on when the chat runs another CLI', () => {
        const lookup = namedChipLookup(providers, accounts, accents, null);

        expect(lookup('model', 'claude', 'claude-haiku-5-5').color).toBe('#0aa');
    });

    test('names an account by its label and paints it its own color', () => {
        expect(namedChipLookup(providers, accounts, accents, null)('account', 'claude', 'claude_work')).toEqual({ label: 'Work', color: '#e46' });
    });

    test('keeps the id of what the machine does not know', () => {
        expect(namedChipLookup([], null, accents, null)('model', 'grok', 'grok-9').label).toBe('grok-9');
    });
});
