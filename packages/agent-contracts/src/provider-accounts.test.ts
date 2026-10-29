import { describe, expect, test } from 'bun:test';
import { orderedAccountIds, ProviderAccountIdSchema, ProviderAccountsSavePayloadSchema, topAccountOf } from './provider-accounts.ts';

describe('provider accounts', () => {
    test('an id is a slug and never a path', () => {
        expect(ProviderAccountIdSchema.safeParse('claude').success).toBe(true);
        expect(ProviderAccountIdSchema.safeParse('claude_personal-2').success).toBe(true);
        expect(ProviderAccountIdSchema.safeParse('Claude').success).toBe(false);
        expect(ProviderAccountIdSchema.safeParse('../claude').success).toBe(false);
        expect(ProviderAccountIdSchema.safeParse('2claude').success).toBe(false);
        expect(ProviderAccountIdSchema.safeParse(`a${'b'.repeat(64)}`).success).toBe(false);
    });

    test('a kind this version does not know still parses', () => {
        const parsed = ProviderAccountsSavePayloadSchema.parse({ accounts: { cursor: { kind: 'cursor', home: '~/.cursor' } } });
        expect(parsed.accounts.cursor).toEqual({ kind: 'cursor', home: '~/.cursor' });
    });

    test('without an order the default account leads and the rest follow by id', () => {
        const accounts = { zeta: { kind: 'claude' }, alpha: { kind: 'claude' }, claude: { kind: 'claude' }, codex: { kind: 'codex' } };
        expect(orderedAccountIds(accounts, 'claude')).toEqual(['claude', 'alpha', 'zeta']);
    });

    test('ordered accounts come first, an account without a place after them', () => {
        const accounts = { claude: { kind: 'claude' }, alpha: { kind: 'claude', order: 1 }, zeta: { kind: 'claude', order: 0 }, beta: { kind: 'claude' } };
        expect(orderedAccountIds(accounts, 'claude')).toEqual(['zeta', 'alpha', 'claude', 'beta']);
    });

    test('the top account is the first one that is on, else the default account', () => {
        expect(topAccountOf({ claude: { kind: 'claude', order: 1 }, work: { kind: 'claude', order: 0, enabled: false } }, 'claude')).toBe('claude');
        expect(topAccountOf({ claude: { kind: 'claude', enabled: false }, work: { kind: 'claude' } }, 'claude')).toBe('work');
        expect(topAccountOf({ claude: { kind: 'claude', enabled: false } }, 'claude')).toBe('claude');
        expect(topAccountOf({}, 'codex')).toBe('codex');
    });
});
