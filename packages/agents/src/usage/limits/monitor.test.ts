import { describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { UsageProvider } from '@adecore/agent-contracts';
import { ProviderRegistry } from '../../providers/registry.ts';
import { UsageMonitor, type LimitAccount, type LimitAccounts } from './monitor.ts';
import type { ProbeResult } from './probe.ts';

function registry(installed: readonly UsageProvider[]): ProviderRegistry {
    return new ProviderRegistry({ detect: (command) => Promise.resolve({ installed: installed.includes(command as UsageProvider), version: '1.0.0' }) });
}

function reading(used: number): ProbeResult {
    return {
        plan: 'max',
        windows: [{ id: 'five_hour', kind: 'session', label: 'Session', used, resetsAt: 1_000, durationMs: 5 * 60 * 60_000 }],
        cost: null
    };
}

function providerOf(monitor: UsageMonitor, kind: UsageProvider) {
    return monitor.snapshot().providers.find((provider) => provider.kind === kind)!;
}

describe('the usage monitor', () => {
    test('reads every installed CLI and says so about the ones that are not there', async () => {
        const monitor = new UsageMonitor({ providers: registry(['claude']), probe: () => Promise.resolve(reading(0.23)) });
        await monitor.refresh(true);
        expect(providerOf(monitor, 'claude')).toMatchObject({ plan: 'max', source: 'probe', unavailable: null });
        expect(providerOf(monitor, 'codex').unavailable).toEqual({ reason: 'not-installed', message: null });
        monitor.stop();
    });

    test('leaves out a provider it has no way to read a plan of', async () => {
        const probed: string[] = [];

        const monitor = new UsageMonitor({
            providers: registry(['claude', 'grok']),
            probe: (kind) => {
                probed.push(kind);

                return Promise.resolve(reading(0.23));
            }
        });

        await monitor.refresh(true);
        expect(monitor.snapshot().providers.map((provider) => provider.kind)).toEqual(['claude', 'codex']);
        expect(probed).toEqual(['claude']);
        monitor.stop();
    });

    test('tells every subscribed client when a number moved', async () => {
        const seen: string[] = [];
        const monitor = new UsageMonitor({ providers: registry(['claude']), probe: () => Promise.resolve(reading(0.23)) });
        monitor.subscribe('client-1', (event) => seen.push(event.event));
        await monitor.refresh(true);
        expect(seen).toEqual(['usage.limitsChanged']);
        monitor.stop();
    });

    test('a turn moves the bar the read drew, keeping its reset', async () => {
        const monitor = new UsageMonitor({ providers: registry(['claude']), probe: () => Promise.resolve(reading(0.23)) });
        await monitor.refresh(true);
        monitor.applyLive({ kind: 'claude', windows: [{ id: 'five_hour', used: 0.42 }] });
        const claude = providerOf(monitor, 'claude');
        expect(claude.source).toBe('event');
        expect(claude.windows[0]).toMatchObject({ used: 0.42, resetsAt: 1_000, label: 'Session' });
        monitor.stop();
    });

    test('a read that failed leaves the last good numbers up and waits longer next time', async () => {
        let now = 1_000;
        let probes = 0;
        let answer: ProbeResult = reading(0.23);

        const monitor = new UsageMonitor({
            providers: registry(['claude']),
            now: () => now,
            probe: () => {
                probes += 1;

                return Promise.resolve(answer);
            }
        });

        await monitor.refresh(false);
        answer = { unavailable: { reason: 'failed', message: 'Claude Code did not answer in time' } };
        now += 5 * 60_000;
        await monitor.refresh(false);
        expect(probes).toBe(2);
        expect(providerOf(monitor, 'claude').windows[0]).toMatchObject({ used: 0.23 });
        expect(providerOf(monitor, 'claude').unavailable).toEqual(answer.unavailable);
        expect(providerOf(monitor, 'claude').checkedAt).toBe(1_000);

        for (const minutes of [10, 20, 40, 60, 60]) {
            const before = probes;
            now += minutes * 60_000 - 1;
            await monitor.refresh(false);
            expect(probes).toBe(before);
            now += 1;
            await monitor.refresh(false);
            expect(probes).toBe(before + 1);
            expect(providerOf(monitor, 'claude').windows[0]).toMatchObject({ used: 0.23 });
        }

        answer = reading(0.42);
        await monitor.refresh(true);
        const afterSuccess = probes;
        expect(providerOf(monitor, 'claude').windows[0]).toMatchObject({ used: 0.42 });
        now += 5 * 60_000 - 1;
        await monitor.refresh(false);
        expect(probes).toBe(afterSuccess);
        now += 1;
        await monitor.refresh(false);
        expect(probes).toBe(afterSuccess + 1);
        monitor.stop();
    });

    test('an account without a plan says so instead of showing nothing', async () => {
        const monitor = new UsageMonitor({
            providers: registry(['claude']),
            probe: () => Promise.resolve({ unavailable: { reason: 'no-subscription', message: null } })
        });

        await monitor.refresh(true);
        expect(providerOf(monitor, 'claude')).toMatchObject({ windows: [], unavailable: { reason: 'no-subscription' } });
        monitor.stop();
    });

    test('a read that takes a while is read again on the very next tick of the clock', async () => {
        const MINUTE = 60_000;
        let now = 0;
        let passes = 0;

        const monitor = new UsageMonitor({
            providers: registry(['claude']),
            now: () => now,
            probe: async () => {
                passes += 1;
                // The read itself takes a few seconds.
                now += 5_000;

                return reading(0.1);
            }
        });

        await monitor.refresh(false);
        // The interval fires five minutes after the first pass started, which is before five minutes after it ended.
        now = 5 * MINUTE;
        await monitor.refresh(false);
        expect(passes).toBe(2);
        monitor.stop();
    });

    test('two callers at once share one pass', async () => {
        let passes = 0;

        const monitor = new UsageMonitor({
            providers: registry(['claude']),
            probe: () => {
                passes += 1;

                return Promise.resolve(reading(0.1));
            }
        });

        await Promise.all([monitor.refresh(true), monitor.refresh(true)]);
        expect(passes).toBe(1);
        monitor.stop();
    });

    test('force joining a normal pass shares one forced follow-up even after stop', async () => {
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const calls: string[] = [];

        const monitor = new UsageMonitor({
            providers: registry(['claude']),
            accounts: {
                list: () => [
                    { id: 'claude', kind: 'claude', label: 'Own', isDefault: true },
                    { id: 'work', kind: 'claude', label: 'Work', isDefault: false }
                ],
                envFor: (_kind, id) => ({ ACCOUNT: id }),
                lastUsedAt: () => null
            },
            now: () => 1_000,
            probe: async (_kind, _command, env) => {
                calls.push(env.ACCOUNT!);

                if (calls.length === 1) {
                    entered.resolve();
                    await release.promise;
                }

                return reading(0.2);
            }
        });

        // The normal pass leaves out the account nobody used here; only the forced one after it reads that account.
        const normal = monitor.refresh(false);
        await entered.promise;
        const forced = monitor.refresh(true);
        const another = monitor.refresh(true);
        const tick = monitor.refresh(false);
        monitor.stop();
        release.resolve();
        await Promise.all([normal, forced, another, tick]);
        expect(calls).toEqual(['claude', 'claude', 'work']);
        expect(monitor.snapshot().providers[1]?.checkedAt).toBe(1_000);
    });

    test.each([1, 2])('a registry failure in pass %i belongs to that pass and does not lose queued force', async (failure) => {
        const providers = registry(['claude']);
        const list = providers.list.bind(providers);
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        let lists = 0;

        const mock = spyOn(providers, 'list').mockImplementation(async () => {
            lists += 1;

            if (lists === 1) {
                entered.resolve();
                await release.promise;
            }

            if (lists === failure) {
                throw new Error('registry unavailable');
            }

            return list();
        });

        const monitor = new UsageMonitor({ providers, probe: () => Promise.resolve(reading(0.2)) });
        const normal = monitor.refresh(false).then(
            () => 'ok',
            (error: Error) => error.message
        );
        await entered.promise;
        const forced = monitor.refresh(true).then(
            () => 'ok',
            (error: Error) => error.message
        );
        release.resolve();
        expect(await normal).toBe(failure === 1 ? 'registry unavailable' : 'ok');
        expect(await forced).toBe(failure === 2 ? 'registry unavailable' : 'ok');
        expect(lists).toBe(2);
        mock.mockRestore();
        monitor.stop();
    });

    test.each(
        ['claude', 'work'].flatMap((account) =>
            [reading(0.1), { unavailable: { reason: 'failed', message: 'old failure' } }, { unavailable: { reason: 'no-subscription', message: null } }].map(
                (result) => ({ account, result: result as ProbeResult })
            )
        )
    )('an older probe never replaces a newer live account update: %j', async ({ account, result }) => {
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const calls: string[] = [];
        let now = 1_000;

        const monitor = new UsageMonitor({
            providers: registry(['claude']),
            accounts: {
                list: () => [
                    { id: 'claude', kind: 'claude', label: 'Own', isDefault: true },
                    { id: 'work', kind: 'claude', label: 'Work', isDefault: false }
                ],
                envFor: (_kind, id) => ({ ACCOUNT: id }),
                lastUsedAt: () => now
            },
            now: () => now,
            probe: async (_kind, _command, env) => {
                calls.push(env.ACCOUNT!);

                if (env.ACCOUNT !== account) {
                    return reading(0.25);
                }

                entered.resolve();
                await release.promise;

                return result;
            }
        });

        const pending = monitor.refresh(true);
        await entered.promise;
        monitor.applyLive({ kind: 'claude', account, windows: [{ id: 'five_hour', used: 0.8 }] });
        release.resolve();
        await pending;
        expect(monitor.snapshot().providers.find((entry) => entry.account?.id === account)).toMatchObject({
            source: 'event',
            checkedAt: 1_000,
            unavailable: null,
            windows: [{ used: 0.8 }]
        });
        expect(monitor.snapshot().providers.find((entry) => entry.account?.id !== account)?.windows[0]?.used).toBe(0.25);
        now += 5 * 60_000;
        await monitor.refresh(false);
        expect(calls.filter((id) => id === account)).toHaveLength('unavailable' in result && result.unavailable?.reason === 'failed' ? 1 : 2);
        monitor.stop();
    });

    test('an old not-installed registry answer cannot erase a live row', async () => {
        const providers = registry([]);
        const answer = Promise.withResolvers<Awaited<ReturnType<ProviderRegistry['list']>>>();
        const mock = spyOn(providers, 'list').mockReturnValueOnce(answer.promise);
        const monitor = new UsageMonitor({ providers, now: () => 1_000 });
        const pending = monitor.refresh(true);
        monitor.applyLive({ kind: 'claude', windows: [{ id: 'five_hour', used: 0.8 }] });
        answer.resolve([]);
        await pending;
        expect(providerOf(monitor, 'claude')).toMatchObject({ source: 'event', unavailable: null, windows: [{ used: 0.8 }] });
        mock.mockRestore();
        monitor.stop();
    });

    describe('per account', () => {
        const HOUR = 60 * 60_000;
        let now = 100 * HOUR;
        const used = new Map<string, number>();

        const accounts = (list: LimitAccount[]): LimitAccounts => ({
            list: () => list,
            envFor: (_kind, id) => ({ ACCOUNT: id }),
            lastUsedAt: (id) => used.get(id) ?? null
        });

        const claudeAccounts: LimitAccount[] = [
            { id: 'claude_work', kind: 'claude', label: 'Work', color: 'blue', isDefault: false },
            { id: 'claude', kind: 'claude', label: 'Claude Code', isDefault: true }
        ];

        const probed: string[] = [];

        const monitorOf = (list: LimitAccount[], file?: string): UsageMonitor =>
            new UsageMonitor({
                providers: registry(['claude']),
                accounts: accounts(list),
                now: () => now,
                ...(file === undefined ? {} : { file }),
                probe: (_kind, _command, env) => {
                    probed.push(env.ACCOUNT!);

                    return Promise.resolve(reading(env.ACCOUNT === 'claude' ? 0.1 : 0.7));
                }
            });

        test('lists the default account of a CLI first, and reads another only while it was used in the last day or when asked', async () => {
            probed.length = 0;
            used.clear();
            const monitor = monitorOf(claudeAccounts);
            await monitor.refresh(false);
            expect(probed).toEqual(['claude']);
            expect(monitor.snapshot().providers.map((provider) => [provider.kind, provider.account?.id, provider.checkedAt > 0])).toEqual([
                ['claude', 'claude', true],
                ['claude', 'claude_work', false]
            ]);

            used.set('claude_work', now - 2 * HOUR);
            now += 6 * 60_000;
            await monitor.refresh(false);
            expect(probed.slice(1)).toEqual(['claude', 'claude_work']);
            expect(monitor.snapshot().providers[1]).toMatchObject({ account: { id: 'claude_work', label: 'Work', color: 'blue' }, windows: [{ used: 0.7 }] });

            used.set('claude_work', now - 25 * HOUR);
            now += 6 * 60_000;
            await monitor.refresh(false);
            expect(probed.slice(3)).toEqual(['claude']);
            await monitor.refresh(true);
            expect(probed.slice(4)).toEqual(['claude', 'claude_work']);
            monitor.stop();
        });

        test('reads an account nobody used here only while a usage page is open, and not after it closed', async () => {
            probed.length = 0;
            used.clear();
            const monitor = monitorOf(claudeAccounts);
            await monitor.refresh(false);
            expect(probed).toEqual(['claude']);

            // The first page reads the account at once; a second one adds no read of its own.
            monitor.watch('phone');
            await monitor.refresh(false);
            expect(probed.slice(1)).toEqual(['claude_work']);
            monitor.watch('desktop');
            await monitor.refresh(false);
            expect(probed.slice(2)).toEqual([]);

            now += 6 * 60_000;
            await monitor.refresh(false);
            expect(probed.slice(2)).toEqual(['claude', 'claude_work']);

            monitor.unwatch('phone');
            now += 6 * 60_000;
            await monitor.refresh(false);
            expect(probed.slice(4)).toEqual(['claude', 'claude_work']);

            // A client that goes lets go of its page, as its socket closing does.
            monitor.subscribe('desktop', () => {})();
            now += 6 * 60_000;
            await monitor.refresh(false);
            expect(probed.slice(6)).toEqual(['claude']);
            monitor.stop();
        });

        test('a restarted host shows the numbers the last one kept until its own read', async () => {
            const home = await mkdtemp(join(tmpdir(), 'adecore-limits-'));
            const file = join(home, 'usage', 'limits.json');

            try {
                const before = monitorOf(claudeAccounts, file);
                await before.refresh(true);
                await before.stop();

                const after = new UsageMonitor({
                    providers: registry(['claude']),
                    accounts: accounts(claudeAccounts),
                    now: () => now,
                    file,
                    probe: () => Promise.resolve(reading(0.3))
                });

                await after.restore();
                expect(after.snapshot().providers.map((provider) => [provider.account?.id, provider.windows[0]?.used])).toEqual([
                    ['claude', 0.1],
                    ['claude_work', 0.7]
                ]);

                await after.refresh(true);
                expect(after.snapshot().providers.map((provider) => provider.windows[0]?.used)).toEqual([0.3, 0.3]);
                await after.stop();
            } finally {
                await rm(home, { recursive: true, force: true });
            }
        });

        test('a kept file that will not parse restores nothing', async () => {
            const home = await mkdtemp(join(tmpdir(), 'adecore-limits-'));
            const file = join(home, 'limits.json');

            try {
                await writeFile(file, '{"version":1,"accounts":');
                const monitor = monitorOf(claudeAccounts, file);
                await monitor.restore();
                expect(monitor.snapshot().providers.every((provider) => provider.checkedAt === 0)).toBe(true);
                await monitor.stop();
            } finally {
                await rm(home, { recursive: true, force: true });
            }
        });

        test('a turn moves the bar of the account it ran under', async () => {
            const monitor = monitorOf(claudeAccounts);
            await monitor.refresh(true);
            monitor.applyLive({ kind: 'claude', account: 'claude_work', windows: [{ id: 'five_hour', used: 0.9 }] });
            const [own, work] = monitor.snapshot().providers;
            expect(own).toMatchObject({ source: 'probe', windows: [{ used: 0.1 }] });
            expect(work).toMatchObject({ source: 'event', windows: [{ used: 0.9, resetsAt: 1_000 }] });
            monitor.stop();
        });

        test('a plan the host reads itself is asked once per account, with the account', async () => {
            const asked: string[] = [];

            const monitor = new UsageMonitor({
                providers: registry([]),
                accounts: accounts([
                    { id: 'grok', kind: 'grok', label: 'Grok', isDefault: true },
                    { id: 'grok_work', kind: 'grok', label: 'Work', isDefault: false }
                ]),
                plans: {
                    grok: (account) => {
                        asked.push(account.id);

                        return Promise.resolve(reading(account.isDefault ? 0.1 : 0.6));
                    }
                }
            });

            await monitor.refresh(true);
            expect(asked).toEqual(['grok', 'grok_work']);
            expect(monitor.snapshot().providers.map((provider) => [provider.account?.id, provider.windows[0]?.used])).toEqual([
                ['grok', 0.1],
                ['grok_work', 0.6]
            ]);

            monitor.stop();
        });

        test('says why an account could not be read', async () => {
            const monitor = new UsageMonitor({
                providers: registry(['claude']),
                accounts: {
                    ...accounts(claudeAccounts),
                    envFor: (_kind, id) => {
                        if (id === 'claude_work') {
                            throw new Error('its folder is missing');
                        }

                        return {};
                    }
                },
                probe: () => Promise.resolve(reading(0.2))
            });

            await monitor.refresh(true);
            expect(monitor.snapshot().providers[1]).toMatchObject({ unavailable: { reason: 'failed', message: 'its folder is missing' } });
            monitor.stop();
        });
    });
});

describe('a plan the host reads itself', () => {
    const reading = (used: number): ProbeResult => ({
        plan: 'Subscription',
        windows: [{ id: 'weekly_input', kind: 'weekly', label: 'Weekly', used, resetsAt: 2_000, durationMs: 7 * 24 * 60 * 60_000 }],
        cost: null
    });

    test('answers for a provider with no CLI, without an environment or an installed check', async () => {
        const probed: string[] = [];

        const monitor = new UsageMonitor({
            providers: registry([]),
            probe: (kind) => {
                probed.push(kind);

                return Promise.resolve(reading(0));
            },
            plans: { nanogpt: () => Promise.resolve(reading(0.4)) }
        });

        await monitor.refresh(true);
        expect(providerOf(monitor, 'nanogpt')).toMatchObject({ plan: 'Subscription', source: 'probe', unavailable: null });
        expect(providerOf(monitor, 'nanogpt').windows[0]).toMatchObject({ id: 'weekly_input', used: 0.4 });
        // The CLIs keep going through the probe, and the provider with a plan of its own never does.
        expect(probed).not.toContain('nanogpt');
        monitor.stop();
    });

    test('what it says is the whole story, a missing key included', async () => {
        const monitor = new UsageMonitor({
            providers: registry([]),
            plans: { nanogpt: () => Promise.resolve({ unavailable: { reason: 'no-subscription', message: 'Add an API key in Settings' } }) }
        });

        await monitor.refresh(true);
        expect(providerOf(monitor, 'nanogpt').unavailable).toEqual({ reason: 'no-subscription', message: 'Add an API key in Settings' });
        monitor.stop();
    });

    test('a read that throws is a failed read and keeps the last good numbers', async () => {
        let fail = false;

        const monitor = new UsageMonitor({
            providers: registry([]),
            plans: {
                nanogpt: () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(reading(0.4)))
            }
        });

        await monitor.refresh(true);
        fail = true;
        await monitor.refresh(true);
        expect(providerOf(monitor, 'nanogpt').windows[0]).toMatchObject({ used: 0.4 });
        monitor.stop();
    });
});
