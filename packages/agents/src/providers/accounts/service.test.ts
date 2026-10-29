import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AgentKind, ProviderAccount, ProviderAccounts, ProviderInfo } from '@adecore/agent-contracts';
import type { AgentEvent } from '../../events.ts';
import { providerFor } from '../registry.ts';
import { ProviderAccountsService } from './service.ts';
import type { ShadowHomeReport } from './shadow-home.ts';
import { memorySecrets } from '../../testing/accounts.ts';
import type { AccountReading } from './status.ts';

// Windows reads the home from USERPROFILE, joins with backslashes and resolves a rooted path onto a drive.
const HOME = process.platform === 'win32' ? 'C:\\Users\\bas' : '/home/bas';
const NOWHERE = resolve('/nowhere');
const env = { HOME, USERPROFILE: HOME, ANTHROPIC_API_KEY: 'sk-ant' };
const installed = new Set<AgentKind>(['claude', 'codex', 'copilot']);

const providers = {
    list: async () => [...installed].map((kind) => ({ kind, installed: true }) as ProviderInfo),
    get: (kind: AgentKind) => providerFor(kind)
};

interface Asked {
    kind: AgentKind;
    folder: string | undefined;
    apiKey: string | undefined;
}

describe('ProviderAccountsService', () => {
    let dir: string;
    let asked: Asked[];
    let answers: Record<string, AccountReading | Error>;
    let folders: Set<string>;
    let installs: string[];
    let shadows: string[];
    let shadowReport: ShadowHomeReport;
    let events: ProviderAccounts[];
    let secrets: ReturnType<typeof memorySecrets> | null;
    let clock: number;

    const make = async (): Promise<ProviderAccountsService> => {
        const service = new ProviderAccountsService({
            home: dir,
            host: { name: 'Host', variablePrefixes: ['HOST_'], keychainPrefix: 'host' },
            providers,
            env,
            ask: async (kind, _command, askedEnv) => {
                const folder = kind === 'claude' ? askedEnv.CLAUDE_CONFIG_DIR : askedEnv.CODEX_HOME;
                asked.push({ kind, folder, apiKey: askedEnv.ANTHROPIC_API_KEY });
                const answer = answers[folder ?? kind] ?? { signedIn: false, email: null, plan: null, organization: null };

                if (answer instanceof Error) {
                    throw answer;
                }

                return answer;
            },
            folderExists: (path) => folders.has(path),
            prepareShadow: async (home, shadow) => {
                shadows.push(`${home} <- ${shadow}`);

                return shadowReport;
            },
            install: async (kind, folder) => {
                installs.push(`${kind} ${folder}`);
            },
            secrets,
            now: () => clock,
            sleep: async (ms) => {
                clock += ms;
            }
        });

        await service.load();

        service.subscribe('client', (event: AgentEvent) => {
            if (event.event === 'accounts.changed') {
                events.push(event.payload);
            }
        });

        return service;
    };

    const stateOf = (snapshot: ProviderAccounts, id: string) => snapshot.statuses.find((status) => status.id === id);

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'ruimte-accounts-'));
        asked = [];
        answers = { claude: { signedIn: true, email: 'work@example.com', plan: 'max', organization: 'Work' } };
        folders = new Set([join(HOME, '.claude_personal'), join(HOME, '.codex'), join(HOME, '.codex_personal')]);
        installs = [];
        shadows = [];
        shadowReport = { linked: [], unshared: [], sharedLogin: false };
        events = [];
        secrets = memorySecrets();
        clock = 1_000;
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('without a file every CLI has its default account, checking until its CLI answered', async () => {
        const service = await make();
        const before = service.snapshot();
        expect(Object.keys(before.accounts)).toEqual(['claude', 'codex', 'gemini', 'copilot', 'apple']);
        expect(before.statuses.every((status) => status.state === 'checking')).toBe(true);

        const after = await service.refresh();

        expect(stateOf(after, 'claude')).toMatchObject({
            state: 'ready',
            email: 'work@example.com',
            plan: 'max',
            organization: 'Work',
            home: join(HOME, '.claude')
        });
        expect(stateOf(after, 'codex')).toMatchObject({ state: 'signed-out', home: join(HOME, '.codex') });
        expect(stateOf(after, 'gemini')?.state).toBe('not-found');
        expect(stateOf(after, 'copilot')?.state).toBe('ready');
        // The default accounts run in the daemon's own environment, key and all.
        expect(asked).toEqual([
            { kind: 'claude', folder: undefined, apiKey: 'sk-ant' },
            { kind: 'codex', folder: undefined, apiKey: 'sk-ant' }
        ]);
        expect(installs).toEqual([]);
    });

    test('a saved account is written, answered as checking and then asked in its own folder', async () => {
        const service = await make();
        answers[join(HOME, '.claude_personal')] = { signedIn: true, email: 'me@example.com', plan: 'pro', organization: null };
        const saved = await service.save({ claude_personal: { kind: 'claude', label: 'Personal', color: 'green', home: '~/.claude_personal' } });
        expect(stateOf(saved, 'claude_personal')?.state).toBe('checking');
        expect(events).toHaveLength(1);

        const file = JSON.parse(await readFile(join(dir, 'providers.json'), 'utf8'));
        expect(file.version).toBe(1);
        expect(file.accounts.claude_personal).toEqual({ kind: 'claude', label: 'Personal', color: 'green', home: '~/.claude_personal' });

        const after = await service.refresh();
        expect(stateOf(after, 'claude_personal')).toMatchObject({ state: 'ready', email: 'me@example.com', home: join(HOME, '.claude_personal') });
        expect(asked).toContainEqual({ kind: 'claude', folder: join(HOME, '.claude_personal'), apiKey: undefined });
        expect(installs).toContain(`claude ${join(HOME, '.claude_personal')}`);
        expect(events.at(-1)).toEqual(after);
    });

    test('a folder that is not there is said without starting a CLI, and so is an account that is off', async () => {
        const service = await make();
        folders.add(NOWHERE);
        await service.save({ claude_gone: { kind: 'claude', home: '/nowhere' }, claude_off: { kind: 'claude', home: '~/.claude_personal', enabled: false } });
        await service.refresh();
        folders.delete(NOWHERE);
        asked = [];
        installs = [];
        const after = await service.refresh();
        expect(stateOf(after, 'claude_gone')).toMatchObject({ state: 'folder-missing', message: `${NOWHERE} does not exist` });
        expect(stateOf(after, 'claude_off')?.state).toBe('disabled');
        expect(asked.length).toBeGreaterThan(0);
        expect(asked.every((entry) => entry.folder === undefined)).toBe(true);
        expect(installs).toEqual([]);
    });

    test('a Codex shadow home is linked to the home it shares before the CLI is asked', async () => {
        const service = await make();
        await service.save({ codex_personal: { kind: 'codex', home: '~/.codex', shadowHome: '~/.codex_personal' } });
        shadowReport = { linked: [], unshared: ['config.toml'], sharedLogin: false };
        const after = await service.refresh();
        // The pass the save started and the refresh after it both prepare the same folders again.
        expect(new Set(shadows)).toEqual(new Set([`${join(HOME, '.codex')} <- ${join(HOME, '.codex_personal')}`]));
        expect(new Set(installs)).toEqual(new Set([`codex ${join(HOME, '.codex')}`]));
        expect(asked).toContainEqual({ kind: 'codex', folder: join(HOME, '.codex_personal'), apiKey: 'sk-ant' });
        expect(stateOf(after, 'codex_personal')).toMatchObject({
            state: 'signed-out',
            home: join(HOME, '.codex_personal'),
            message: `Not shared with ${join(HOME, '.codex')}: config.toml`
        });

        shadowReport = { linked: [], unshared: [], sharedLogin: true };
        expect(stateOf(await service.refresh(), 'codex_personal')?.state).toBe('failed');
    });

    test('a CLI that fails to answer is a failed account with its reason', async () => {
        answers.claude = new Error('Claude Code did not answer in time');
        const service = await make();
        expect(stateOf(await service.refresh(), 'claude')).toMatchObject({ state: 'failed', message: 'Claude Code did not answer in time' });
    });

    test('publishes only when a person would read something else', async () => {
        const service = await make();
        await service.refresh();
        expect(events).toHaveLength(1);
        await service.refresh();
        expect(events).toHaveLength(1);
        answers.claude = { signedIn: false, email: null, plan: null, organization: null };
        await service.refresh();
        expect(events).toHaveLength(2);
    });

    test('an account a save changed is published again once checked, even when its CLI says the same', async () => {
        const service = await make();
        await service.refresh();
        await service.save({ claude: { kind: 'claude', label: 'Work' } });
        expect(stateOf(events.at(-1)!, 'claude')?.state).toBe('checking');
        await service.refresh();
        expect(stateOf(events.at(-1)!, 'claude')?.state).toBe('ready');
    });

    test("puts the accounts of one CLI in a person's order, and the top one that is on is where a start goes", async () => {
        const service = await make();
        await service.save({
            claude_personal: { kind: 'claude', label: 'Personal', home: '~/.claude_personal' },
            codex_personal: { kind: 'codex', label: 'Codex', home: '~/.codex_personal' }
        });
        expect(service.defaultFor('claude')).toBe('claude');

        const reordered = await service.reorder('claude', ['claude_personal', 'claude']);
        expect(reordered.accounts.claude_personal?.order).toBe(0);
        expect(reordered.accounts.claude?.order).toBe(1);
        expect(reordered.accounts.codex_personal?.order).toBeUndefined();
        expect(service.defaultFor('claude')).toBe('claude_personal');

        const file = JSON.parse(await readFile(join(dir, 'providers.json'), 'utf8'));
        expect(file.accounts.claude_personal.order).toBe(0);

        await service.save({ ...reordered.accounts, claude_personal: { ...reordered.accounts.claude_personal, enabled: false } as ProviderAccount });
        expect(service.defaultFor('claude')).toBe('claude');
    });

    test('keeps the order of an account an older client saves without one', async () => {
        const service = await make();
        await service.save({ claude_personal: { kind: 'claude', label: 'Personal', home: '~/.claude_personal' } });
        await service.reorder('claude', ['claude_personal', 'claude']);
        const saved = await service.save({ claude_personal: { kind: 'claude', label: 'Mine', home: '~/.claude_personal' } });
        expect(saved.accounts.claude_personal).toMatchObject({ label: 'Mine', order: 0 });
        expect(saved.accounts.claude?.order).toBe(1);
    });

    test('puts an account a reorder leaves out after the ones it names, and refuses another CLI or an unknown id', async () => {
        const service = await make();
        await service.save({
            claude_personal: { kind: 'claude', label: 'Personal', home: '~/.claude_personal' },
            codex_personal: { kind: 'codex', label: 'Codex', home: '~/.codex_personal' }
        });
        const reordered = await service.reorder('claude', ['claude_personal']);
        expect(reordered.accounts.claude?.order).toBe(1);
        expect(service.reorder('claude', ['codex_personal'])).rejects.toThrow('codex_personal');
        expect(service.reorder('claude', ['nobody'])).rejects.toThrow('nobody');
        expect(service.reorder('claude', ['claude', 'claude'])).rejects.toThrow('twice');
    });

    test('refuses a save with a mistake in it and leaves the file alone', async () => {
        const service = await make();
        expect(service.save({ claude_personal: { kind: 'claude' } })).rejects.toThrow('claude_personal');
        expect(service.save({ claude: { kind: 'claude', home: '~/.x' } })).rejects.toThrow();
        expect(readFile(join(dir, 'providers.json'), 'utf8')).rejects.toThrow();
    });

    test('keeps an account of a kind it does not know as it was written, and says it is unavailable', async () => {
        const raw = { kind: 'cursor', home: '~/.cursor', future: 1 };
        await writeFile(join(dir, 'providers.json'), JSON.stringify({ version: 1, accounts: { cursor_work: raw, claude_bad: { kind: 'claude' } } }));
        const service = await make();
        const snapshot = service.snapshot();
        expect(snapshot.accounts.cursor_work).toEqual({ kind: 'cursor', home: '~/.cursor' });
        expect(snapshot.accounts.claude_bad).toBeUndefined();

        await service.save({ ...snapshot.accounts, cursor_work: { kind: 'cursor' } });
        const file = JSON.parse(await readFile(join(dir, 'providers.json'), 'utf8'));
        expect(file.accounts.cursor_work).toEqual(raw);
        expect(stateOf(await service.refresh(), 'cursor_work')?.state).toBe('unavailable');
    });

    test('gives a launch the environment of its account', async () => {
        const service = await make();
        await service.save({ claude_personal: { kind: 'claude', label: 'Personal', home: '~/.claude_personal' } });
        expect(service.envFor('claude', undefined, env)).toBe(env);
        expect(service.envFor('claude', 'claude', env)).toBe(env);
        expect(service.envFor('claude', 'claude_personal', env)).toEqual({ HOME, USERPROFILE: HOME, CLAUDE_CONFIG_DIR: join(HOME, '.claude_personal') });
    });

    test('refuses a turned-off default account a start names, and still gives a start that names none its environment', async () => {
        const service = await make();
        await service.save({ claude: { kind: 'claude', enabled: false } });
        let refusal: unknown = null;

        try {
            service.envFor('claude', 'claude', env);
        } catch (e) {
            refusal = e;
        }

        expect(refusal).toMatchObject({ code: 'account-unavailable', message: expect.stringContaining('it is turned off') });
        expect(service.envFor('claude', undefined, env)).toBe(env);
        await service.save({ claude: { kind: 'claude' } });
        expect(service.envFor('claude', 'claude', env)).toBe(env);
        expect(service.envFor('claude', undefined, env)).toBe(env);
    });

    test('refuses an account it cannot start, and never falls back on the default one', async () => {
        const service = await make();
        folders.add(join(HOME, '.claude_gone'));

        await service.save({
            claude_personal: { kind: 'claude', label: 'Personal', home: '~/.claude_personal' },
            claude_gone: { kind: 'claude', label: 'Gone', home: '~/.claude_gone' },
            claude_off: { kind: 'claude', home: '~/.claude_personal', enabled: false },
            codex_personal: { kind: 'codex', home: '~/.codex_personal' }
        });

        folders.delete(join(HOME, '.claude_gone'));

        const refusal = (kind: AgentKind, id: string): unknown => {
            try {
                service.envFor(kind, id, env);
            } catch (e) {
                return e;
            }

            return null;
        };

        expect(refusal('claude', 'claude_gone')).toMatchObject({
            code: 'account-unavailable',
            message: "The account 'Gone' is not available on this machine: its folder ~/.claude_gone is missing."
        });
        expect(refusal('claude', 'nobody')).toMatchObject({ code: 'account-unavailable' });
        expect(refusal('claude', 'claude_off')).toMatchObject({ code: 'account-unavailable', message: expect.stringContaining('turned off') });
        expect(refusal('claude', 'codex_personal')).toMatchObject({ code: 'account-unavailable', message: expect.stringContaining('an account of Codex') });
    });

    test('tells which accounts can go on with a conversation', async () => {
        const service = await make();

        await service.save({
            claude_personal: { kind: 'claude', home: '~/.claude_personal' },
            codex_personal: { kind: 'codex', home: '~/.codex', shadowHome: '~/.codex_personal' }
        });

        expect(service.canContinue('claude', undefined, 'claude')).toBe(true);
        expect(service.canContinue('claude', undefined, 'claude_personal')).toBe(false);
        expect(service.canContinue('codex', undefined, 'codex_personal')).toBe(true);
        expect(service.transcriptFolder('claude', 'claude_personal')).toBe(join(HOME, '.claude_personal'));
        expect(service.transcriptFolder('claude', 'nobody')).toBeNull();
    });

    test('tells a client where each account writes its conversations, so it can say which can go on with one', async () => {
        const service = await make();

        await service.save({
            claude_personal: { kind: 'claude', home: '~/.claude_personal' },
            codex_personal: { kind: 'codex', home: '~/.codex', shadowHome: '~/.codex_personal' }
        });

        const snapshot = service.snapshot();
        expect(stateOf(snapshot, 'claude_personal')?.transcripts).toBe(join(HOME, '.claude_personal'));
        expect(stateOf(snapshot, 'codex_personal')?.home).toBe(join(HOME, '.codex_personal'));
        expect(stateOf(snapshot, 'codex_personal')?.transcripts).toBe(stateOf(snapshot, 'codex')?.transcripts);
    });

    test('creates a Claude account in a folder of its own that only the person can read', async () => {
        const service = await make();
        const created = await service.create({ kind: 'claude', label: 'Personal', color: 'green' });
        const folder = join(dir, 'accounts', 'claude_personal');
        expect(created.id).toBe('claude_personal');
        expect(created.accounts.claude_personal).toEqual({ kind: 'claude', label: 'Personal', color: 'green', home: folder });

        // Windows has no mode bits; the profile's ACL keeps the folder the person's there.
        if (process.platform !== 'win32') {
            expect((await stat(folder)).mode & 0o777).toBe(0o700);
        }

        expect(installs).toContain(`claude ${folder}`);
        const file = JSON.parse(await readFile(join(dir, 'providers.json'), 'utf8'));
        expect(file.accounts.claude_personal.home).toBe(folder);
    });

    test('mints another id for the same label, and never one whose folder a removed account left', async () => {
        const service = await make();
        await service.create({ kind: 'claude', label: 'Werk (Café)' });
        await service.save({});
        const again = await service.create({ kind: 'claude', label: 'Werk (Café)' });
        expect(again.id).toBe('claude_werk-cafe-2');
        expect(again.accounts.claude_werk).toBeUndefined();
        expect(again.accounts['claude_werk-cafe']).toBeUndefined();
        // Forgetting an account never removes its folder.
        expect((await stat(join(dir, 'accounts', 'claude_werk-cafe'))).isDirectory()).toBe(true);
        expect((await service.create({ kind: 'claude', label: '!!!' })).id).toBe('claude_account');
    });

    test('creates a Codex account as a shadow home over the CLI folder', async () => {
        const service = await make();
        const created = await service.create({ kind: 'codex', label: 'Personal' });
        const folder = join(dir, 'accounts', 'codex_personal');
        expect(created.accounts.codex_personal).toEqual({ kind: 'codex', label: 'Personal', home: join(HOME, '.codex'), shadowHome: folder });
        expect(shadows).toContain(`${join(HOME, '.codex')} <- ${folder}`);
        expect(service.canContinue('codex', undefined, 'codex_personal')).toBe(true);
    });

    test('refuses to create an account for a CLI without a config folder', async () => {
        const service = await make();
        await expect(service.create({ kind: 'gemini', label: 'Work' })).rejects.toMatchObject({ code: 'invalid-account' });
    });

    test('links an existing folder only when it is one, and never the folder of the default account', async () => {
        const service = await make();
        await expect(service.save({ claude_elsewhere: { kind: 'claude', home: '/nowhere' } })).rejects.toThrow('/nowhere is not a folder on this machine');
        folders.add(join(HOME, '.claude'));
        await expect(service.save({ claude_same: { kind: 'claude', home: '~/.claude' } })).rejects.toThrow('the default Claude Code account');
        await expect(service.save({ codex_same: { kind: 'codex', home: '~/.codex_personal', shadowHome: '~/.codex' } })).rejects.toThrow(
            'the default Codex account'
        );

        const saved = await service.save({ claude_personal: { kind: 'claude', home: '~/.claude_personal' } });
        expect(saved.accounts.claude_personal?.home).toBe('~/.claude_personal');
    });

    test('keeps a plain variable in the file and a sensitive one only in the keychain', async () => {
        const service = await make();

        const saved = await service.save({
            claude_personal: {
                kind: 'claude',
                home: '~/.claude_personal',
                env: [
                    { name: 'ANTHROPIC_BASE_URL', value: 'https://proxy.example', sensitive: false },
                    { name: 'ANTHROPIC_API_KEY', value: 'sk-mine', sensitive: true }
                ]
            }
        });

        const redacted = { name: 'ANTHROPIC_API_KEY', value: '', sensitive: true, valueRedacted: true };
        expect(saved.accounts.claude_personal?.env).toEqual([{ name: 'ANTHROPIC_BASE_URL', value: 'https://proxy.example', sensitive: false }, redacted]);
        expect(saved.secretsAvailable).toBe(true);
        expect(secrets?.values.get('claude_personal/ANTHROPIC_API_KEY')).toBe('sk-mine');
        const text = await readFile(join(dir, 'providers.json'), 'utf8');
        expect(text).not.toContain('sk-mine');
        expect(JSON.parse(text).accounts.claude_personal.env[1]).toEqual(redacted);

        // The login variables go first, so the key a person set is the one the CLI gets.
        expect(service.envFor('claude', 'claude_personal', env)).toEqual({
            HOME,
            USERPROFILE: HOME,
            CLAUDE_CONFIG_DIR: join(HOME, '.claude_personal'),
            ANTHROPIC_BASE_URL: 'https://proxy.example',
            ANTHROPIC_API_KEY: 'sk-mine'
        });

        // A later daemon reads the value back from the keychain.
        const later = await make();
        expect(later.envFor('claude', 'claude_personal', env).ANTHROPIC_API_KEY).toBe('sk-mine');
    });

    test('keeps a secret a save sends back redacted, and removes one that went', async () => {
        const service = await make();
        const account = { kind: 'claude', home: '~/.claude_personal' };
        await service.save({ claude_personal: { ...account, env: [{ name: 'ANTHROPIC_API_KEY', value: 'sk-mine', sensitive: true }] } });
        const round = await service.save(service.snapshot().accounts);
        expect(round.accounts.claude_personal?.env?.[0]?.valueRedacted).toBe(true);
        expect(secrets?.values.get('claude_personal/ANTHROPIC_API_KEY')).toBe('sk-mine');

        await service.save({ claude_personal: { ...account, env: [{ name: 'ANTHROPIC_API_KEY', value: 'sk-new', sensitive: true }] } });
        expect(secrets?.values.get('claude_personal/ANTHROPIC_API_KEY')).toBe('sk-new');

        await service.save({ claude_personal: account });
        expect(secrets?.values.size).toBe(0);
        expect(service.envFor('claude', 'claude_personal', env).ANTHROPIC_API_KEY).toBeUndefined();

        await service.save({ claude_personal: { ...account, env: [{ name: 'ANTHROPIC_API_KEY', value: 'sk-mine', sensitive: true }] } });
        await service.save({});
        expect(secrets?.values.size).toBe(0);
    });

    test('refuses a redacted secret it never had, a reserved name and a name set twice', async () => {
        const service = await make();
        const home = '~/.claude_personal';

        const refused = (variables: NonNullable<ProviderAccounts['accounts'][string]['env']>) =>
            service.save({ claude_personal: { kind: 'claude', home, env: variables } });

        await expect(refused([{ name: 'ANTHROPIC_API_KEY', value: '', sensitive: true, valueRedacted: true }])).rejects.toThrow('has no value');

        for (const name of ['HOME', 'PATH', 'HOST_CONTEXT_URL', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME']) {
            await expect(refused([{ name, value: 'x', sensitive: false }])).rejects.toThrow(`${name} is set by Host itself`);
        }

        await expect(
            refused([
                { name: 'A', value: '1', sensitive: false },
                { name: 'A', value: '2', sensitive: false }
            ])
        ).rejects.toThrow('A is set twice');
        await expect(refused([{ name: 'KEY', value: 'line\nbreak', sensitive: true }])).rejects.toThrow('printable ASCII');
    });

    test('refuses a sensitive variable on a machine without a keychain, and says so', async () => {
        secrets = null;
        const service = await make();
        expect(service.snapshot().secretsAvailable).toBe(false);
        await expect(service.save({ claude: { kind: 'claude', env: [{ name: 'ANTHROPIC_API_KEY', value: 'sk', sensitive: true }] } })).rejects.toMatchObject({
            code: 'secrets-unavailable'
        });

        const saved = await service.save({ claude: { kind: 'claude', env: [{ name: 'DISABLE_TELEMETRY', value: '1', sensitive: false }] } });
        expect(saved.accounts.claude?.env).toHaveLength(1);
    });

    test('gives the default account its variables on top of the daemon environment', async () => {
        const service = await make();
        await service.save({ claude: { kind: 'claude', env: [{ name: 'DISABLE_TELEMETRY', value: '1', sensitive: false }] } });
        expect(service.envFor('claude', undefined, env)).toEqual({ ...env, DISABLE_TELEMETRY: '1' });
        expect(service.envFor('codex', undefined, env)).toBe(env);
    });

    test('refuses a start whose secret the keychain does not give', async () => {
        const service = await make();

        await service.save({
            claude_personal: { kind: 'claude', home: '~/.claude_personal', env: [{ name: 'ANTHROPIC_API_KEY', value: 'sk-mine', sensitive: true }] }
        });

        secrets?.values.clear();
        const later = await make();
        expect(() => later.envFor('claude', 'claude_personal', env)).toThrow('the keychain does not give the value of ANTHROPIC_API_KEY');
    });

    test('says what a terminal types to sign each CLI in', async () => {
        const service = await make();
        expect(service.snapshot().loginCommands).toEqual({ claude: 'claude auth login', codex: 'codex login' });
    });

    test('watches a login every few seconds until the CLI says it is signed in', async () => {
        const service = await make();
        await service.save({ claude_personal: { kind: 'claude', home: '~/.claude_personal' } });
        await service.refresh();
        asked = [];
        const eventsBefore = events.length;
        const start = clock;
        let checks = 0;
        const ask = answers;

        answers = new Proxy(ask, {
            get: (target, key) => {
                if (key === join(HOME, '.claude_personal')) {
                    checks += 1;

                    return checks >= 3 ? { signedIn: true, email: 'me@example.com', plan: 'pro', organization: null } : undefined;
                }

                return target[key as string];
            }
        });

        await service.watchLogin('claude_personal');
        expect(checks).toBe(3);
        expect(clock - start).toBe(9_000);
        expect(asked.every((entry) => entry.folder === join(HOME, '.claude_personal'))).toBe(true);
        expect(stateOf(service.snapshot(), 'claude_personal')).toMatchObject({ state: 'ready', email: 'me@example.com' });
        expect(events.length).toBe(eventsBefore + 1);
    });

    test('gives a login up after five minutes', async () => {
        const service = await make();
        await service.save({ claude_personal: { kind: 'claude', home: '~/.claude_personal' } });
        await service.refresh();
        asked = [];
        const start = clock;
        await service.watchLogin('claude_personal');
        expect(clock - start).toBe(5 * 60_000);
        expect(asked).toHaveLength(100);
        expect(() => service.watchLogin('nobody')).toThrow("The account 'nobody' is not available");
    });
});

describe('ProviderAccountsService kinds', () => {
    test('holds a default account only for the CLIs the host offers', () => {
        const service = new ProviderAccountsService({ home: NOWHERE, providers: { ...providers, kinds: () => ['claude', 'grok'] }, env, secrets: null });
        expect(Object.keys(service.snapshot().accounts)).toEqual(['claude', 'grok']);
    });

    test('a host that names no kinds gets one for every kind this version knows', () => {
        const service = new ProviderAccountsService({ home: NOWHERE, providers, env, secrets: null });
        expect(Object.keys(service.snapshot().accounts)).toEqual(['claude', 'codex', 'gemini', 'copilot', 'apple']);
    });
});

describe('ProviderAccountsService for a CLI that signs in from its chat', () => {
    const acme = { ...providerFor('claude'), kind: 'acme', name: 'Acme', home: { env: 'ACME_HOME', fallback: '.acme', loginEnv: [] } };

    const withAcme = {
        list: async () => (['claude', 'acme'] as AgentKind[]).map((kind) => ({ kind, installed: true }) as ProviderInfo),
        get: (kind: AgentKind) => (kind === 'acme' ? acme : providerFor(kind)),
        kinds: (): AgentKind[] => ['claude', 'acme']
    };

    let dir: string;
    let asked: AgentKind[];

    const make = async (): Promise<ProviderAccountsService> => {
        const service = new ProviderAccountsService({
            home: dir,
            providers: withAcme,
            env,
            secrets: null,
            ask: async (kind) => {
                asked.push(kind);

                return { signedIn: true, email: null, plan: null, organization: null };
            },
            folderExists: () => true,
            prepareShadow: async () => ({ linked: [], unshared: [], sharedLogin: false })
        });

        await service.load();

        return service;
    };

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'ruimte-accounts-'));
        asked = [];
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('names it apart from the CLIs a terminal signs in', async () => {
        const snapshot = (await make()).snapshot();
        expect(snapshot.loginCommands).toEqual({ claude: 'claude auth login' });
        expect(snapshot.chatLogins).toEqual(['acme']);
    });

    test('makes it an account in a folder of its own', async () => {
        const service = await make();
        const created = await service.create({ kind: 'acme', label: 'Work' });
        expect(created.accounts.acme_work).toEqual({ kind: 'acme', label: 'Work', home: join(dir, 'accounts', 'acme_work') });
    });

    test('takes its account as ready without asking who is signed in', async () => {
        const service = await make();
        await service.create({ kind: 'acme', label: 'Work' });
        await service.refresh();
        expect(service.snapshot().statuses.find((status) => status.id === 'acme_work')).toMatchObject({ state: 'ready' });
        expect(asked).not.toContain('acme');
    });
});

describe('ProviderAccountsService for a CLI with a reader of its own', () => {
    const reading = { signedIn: true, email: null, plan: null, organization: null };
    const askedBy: string[] = [];

    const home = (kind: string) => ({ env: `${kind.toUpperCase()}_HOME`, fallback: `.${kind}`, loginEnv: [], loginCommand: `${kind} login` });

    const reader = {
        ...providerFor('claude'),
        kind: 'reader',
        name: 'Reader',
        home: home('reader'),
        askAccount: async (_command: readonly string[], askedEnv: Record<string, string | undefined>) => {
            askedBy.push(`reader ${askedEnv.READER_HOME}`);

            return reading;
        }
    };

    const silent = { ...providerFor('claude'), kind: 'silent', name: 'Silent', home: home('silent') };
    const kinds: AgentKind[] = ['claude', 'reader', 'silent'];

    const withReaders = {
        list: async () => kinds.map((kind) => ({ kind, installed: true }) as ProviderInfo),
        get: (kind: AgentKind) => (kind === 'reader' ? reader : kind === 'silent' ? silent : providerFor(kind)),
        kinds: () => kinds
    };

    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'ruimte-accounts-'));
        askedBy.length = 0;
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    const make = async (ask?: () => Promise<AccountReading>): Promise<ProviderAccountsService> => {
        const service = new ProviderAccountsService({
            home: dir,
            providers: withReaders,
            env,
            secrets: null,
            ...(ask ? { ask } : {}),
            folderExists: () => true,
            prepareShadow: async () => ({ linked: [], unshared: [], sharedLogin: false })
        });

        await service.load();

        return service;
    };

    test('asks the provider before the host', async () => {
        const service = await make(async () => {
            askedBy.push('host');

            return reading;
        });

        await service.save({ reader_work: { kind: 'reader', home: '~/.reader_work' } });
        await service.refresh();
        expect(service.snapshot().statuses.find((status) => status.id === 'reader_work')).toMatchObject({ state: 'ready' });
        expect(askedBy).toContain(`reader ${join(HOME, '.reader_work')}`);
    });

    test('names the CLIs whose login nothing notices', async () => {
        expect((await make()).snapshot().silentLogins).toEqual(['silent']);
        expect((await make(async () => reading)).snapshot().silentLogins).toBeUndefined();
    });
});
