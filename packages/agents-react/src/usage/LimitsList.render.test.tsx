import { expect, test } from 'bun:test';
import type { UsageLimitsProvider, UsageLimitsSnapshot } from '@adecore/agent-contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { limitGroups } from './limit-groups';
import { AccountLimitsList, LimitsList } from './LimitsList';

const NOW = 1_800_000_000_000;

function entry(id: string, extra: Partial<UsageLimitsProvider> = {}): UsageLimitsProvider {
    return {
        kind: 'claude',
        account: { id, label: id === 'claude' ? 'Own' : 'Work' },
        plan: 'max',
        checkedAt: NOW - 60_000,
        source: 'probe',
        windows: [{ id: 'five_hour', kind: 'session', used: 0.4, durationMs: 18_000_000, resetsAt: NOW + 3_600_000 }],
        cost: null,
        unavailable: null,
        ...extra
    } as UsageLimitsProvider;
}

const failed = { unavailable: { reason: 'failed', message: 'The CLI did not answer' } } as const;

test('a failed read keeps the last numbers with a readable status instead of the technical error', () => {
    const limits: UsageLimitsSnapshot = { providers: [entry('claude', failed)] };
    const html = renderToStaticMarkup(<LimitsList limits={limits} now={NOW} />);

    expect(html).toContain('Last known numbers');
    expect(html).toContain('40%');
    expect(html).toContain('Could not check the limits.');
    expect(html).not.toContain('The CLI did not answer');
});

test('an account row keeps its bars after a failed read without exposing the technical error', () => {
    const snapshot: UsageLimitsSnapshot = { providers: [entry('claude'), entry('work', failed)] };
    const groups = limitGroups(snapshot, null);
    const html = renderToStaticMarkup(<AccountLimitsList groups={groups} now={NOW} folded={new Set()} onFoldedChange={() => {}} />);
    const work = html.slice(html.indexOf('Work'));

    expect(work).toContain('Last known numbers');
    expect(work).toContain('Could not check the limits.');
    expect(work).not.toContain('The CLI did not answer');
    expect(work).toContain('40%');
});

test('numbers older than ten minutes say they may be out of date', () => {
    const limits: UsageLimitsSnapshot = { providers: [entry('claude', { checkedAt: NOW - 600_000 })] };

    expect(renderToStaticMarkup(<LimitsList limits={limits} now={NOW} />)).toContain('May be out of date');
    expect(renderToStaticMarkup(<LimitsList limits={{ providers: [entry('claude', { checkedAt: NOW - 599_000 })] }} now={NOW} />)).not.toContain(
        'May be out of date'
    );
});
