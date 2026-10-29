import { describe, expect, test } from 'bun:test';
import type { ProviderAccountMap } from '@adecore/agent-contracts';
import { chooseAccount, type AccountChoiceInput, type AccountUnusable } from './choose.ts';

const accounts: ProviderAccountMap = {
    claude: { kind: 'claude', order: 2 },
    work: { kind: 'claude', order: 0 },
    client: { kind: 'claude', order: 1 },
    codex: { kind: 'codex' }
};

function choose(input: Partial<AccountChoiceInput>, unusable: Record<string, AccountUnusable> = {}) {
    return chooseAccount({ kind: 'claude', accounts, named: undefined, preferred: undefined, off: [], unusable: (id) => unusable[id] ?? null, ...input });
}

describe('the account a start takes', () => {
    test('a named account starts as named, unless the project turned it off', () => {
        expect(choose({ named: 'client', preferred: 'work' })).toEqual({ account: 'client' });
        expect(() => choose({ named: 'client', off: ['client'] })).toThrow('turned off in this project');
    });

    test('the project default while it is usable, else the next account it offers, saying why', () => {
        expect(choose({ preferred: 'client' })).toEqual({ account: 'client' });
        expect(choose({ preferred: 'client' }, { client: 'signed out' })).toEqual({ account: 'work', passedOver: { account: 'client', reason: 'signed out' } });
        expect(choose({ preferred: 'client', off: ['work'] }, { client: 'at its usage limit' })).toEqual({
            account: 'claude',
            passedOver: { account: 'client', reason: 'at its usage limit' }
        });
    });

    test('without a project default the top usable account it offers, and nothing passed over', () => {
        expect(choose({})).toEqual({ account: 'work' });
        expect(choose({ off: ['work'] })).toEqual({ account: 'client' });
        expect(choose({}, { work: 'turned off on this machine' })).toEqual({ account: 'client' });
        expect(choose({ preferred: 'gone' })).toEqual({ account: 'work' });
    });

    test('with nothing usable the CLI default account, which the launch then judges', () => {
        expect(choose({ off: ['work', 'client'] }, { claude: 'signed out' })).toEqual({ account: 'claude' });
    });

    test('never falls back on a CLI default account the project turned off', () => {
        expect(() => choose({ preferred: 'work', off: ['claude'] }, { work: 'signed out', client: 'signed out' })).toThrow('No account this project offers');
    });
});
