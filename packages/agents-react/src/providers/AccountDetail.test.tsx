import { describe, expect, test } from 'bun:test';
import type { ProviderInfo } from '@adecore/agent-contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountEntry, AccountLogin } from '../agents/accounts';
import { ChatScopeContext, type ChatScope } from '../scope';
import { AccountDetail } from './AccountDetail';

const provider = { kind: 'acme', name: 'Acme', installed: true, models: [], capabilities: { terminal: true } } as unknown as ProviderInfo;

const entry: AccountEntry = {
    id: 'acme_work',
    account: { kind: 'acme', label: 'Work', home: '/home/acme_work' },
    isDefault: false,
    status: {
        id: 'acme_work',
        kind: 'acme',
        state: 'ready',
        email: null,
        plan: null,
        organization: null,
        home: '/home/acme_work',
        message: null,
        checkedAt: 1
    }
};

const scope = { id: 'host' } as ChatScope;

const render = (login: AccountLogin, canOpenLogin = true): string =>
    renderToStaticMarkup(
        createElement(
            ChatScopeContext.Provider,
            { value: scope },
            createElement(AccountDetail, { provider, entry, login, canOpenLogin, loginBlocked: null, secretsAvailable: false, onRemoved: () => {} })
        )
    );

describe('AccountDetail', () => {
    test('an account that signs in from its chat says so and offers no terminal login', () => {
        const markup = render('chat');
        expect(markup).toContain('Logs in from a chat');
        expect(markup).toContain('/home/acme_work');
        expect(markup).not.toContain('Log in again');
    });

    test('says so also where the host opens no terminal', () => {
        expect(render('chat', false)).toContain('Logs in from a chat');
    });

    test('an account that signs in in a terminal keeps its login button', () => {
        const markup = render('terminal');
        expect(markup).toContain('Log in again');
        expect(markup).not.toContain('Logs in from a chat');
    });

    test('a terminal login is left out where the host opens no terminal', () => {
        expect(render('terminal', false)).not.toContain('Log in again');
    });
});
