import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentKind, ProviderInfo } from '@adecore/agent-contracts';
import { createAntigravityProvider } from '../acp-vendors.ts';
import type { ChatProvider } from '../provider.ts';
import type { Env } from './accounts.ts';
import { ProviderAccountsService } from './service.ts';

const NO_SSH = '127.0.0.1 0 127.0.0.1 0';

/* agy 1.5's sign-in: one keyring entry for every folder, unless the environment says SSH; then a file in `GEMINI_HOME`. */
function fakeAgy() {
    let keyring: string | null = null;
    const files = new Map<string, string>();

    const inFile = (env: Env): string | null => (env.SSH_CONNECTION ? (env.GEMINI_HOME ?? 'home') : null);

    return {
        signIn: (env: Env, who: string): void => {
            const file = inFile(env);

            if (file === null) {
                keyring = who;
            } else {
                files.set(file, who);
            }
        },
        signOut: (env: Env): void => {
            const file = inFile(env);

            if (file === null) {
                keyring = null;
            } else {
                files.delete(file);
            }
        },
        whoIs: (env: Env): string | null => {
            const file = inFile(env);

            return file === null ? keyring : (files.get(file) ?? null);
        }
    };
}

describe('Antigravity accounts kept apart', () => {
    let dir: string;
    let env: Env;
    let installs: string[];

    const make = async (provider: ChatProvider): Promise<ProviderAccountsService> => {
        const signedIn: ChatProvider = { ...provider, askAccount: async () => ({ signedIn: true, email: null, plan: null, organization: null }) };

        const service = new ProviderAccountsService({
            home: join(dir, 'host'),
            providers: {
                list: async () => [{ kind: 'antigravity', installed: true } as ProviderInfo],
                get: () => signedIn,
                kinds: (): AgentKind[] => ['antigravity']
            },
            env,
            install: async (kind, folder) => {
                installs.push(`${kind} ${folder}`);
            },
            secrets: null
        });

        await service.load();

        return service;
    };

    const workAccount = async (service: ProviderAccountsService): Promise<string> => (await service.create({ kind: 'antigravity', label: 'Work' })).id;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'adecore-apart-'));
        env = { HOME: join(dir, 'person'), USERPROFILE: join(dir, 'person') };
        installs = [];
        await mkdir(join(dir, 'person', '.gemini', 'config', 'skills'), { recursive: true });
        await writeFile(join(dir, 'person', '.gemini', 'GEMINI.md'), '# mine');
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('every account starts in a folder of its own with SSH_CONNECTION, the default one included', async () => {
        const defaultHome = join(dir, 'host', 'accounts', 'antigravity');
        const service = await make(createAntigravityProvider({ defaultHome }));
        const work = await workAccount(service);

        expect(service.envFor('antigravity', undefined, env)).toMatchObject({ GEMINI_HOME: defaultHome, SSH_CONNECTION: NO_SSH });
        expect(service.envFor('antigravity', work, env)).toMatchObject({ GEMINI_HOME: join(dir, 'host', 'accounts', work), SSH_CONNECTION: NO_SSH });
        expect(service.envFor('antigravity', work, { ...env, SSH_CONNECTION: '10.0.0.2 51000 10.0.0.1 22' }).SSH_CONNECTION).toBe('10.0.0.2 51000 10.0.0.1 22');
    });

    test('signing out one account leaves the other signed in', async () => {
        const agy = fakeAgy();
        const service = await make(createAntigravityProvider({ defaultHome: join(dir, 'host', 'accounts', 'antigravity') }));
        const work = await workAccount(service);
        const own = service.envFor('antigravity', undefined, env);
        const other = service.envFor('antigravity', work, env);

        agy.signIn(own, 'private@example.com');
        agy.signIn(other, 'work@example.com');
        agy.signOut(other);

        expect(agy.whoIs(own)).toBe('private@example.com');
        expect(agy.whoIs(other)).toBeNull();
    });

    test('without SSH_CONNECTION the fake signs every folder out at once', async () => {
        const agy = fakeAgy();
        const provider = createAntigravityProvider();
        const { apart: _apart, ...home } = provider.home!;
        const service = await make({ ...provider, home });
        const work = await workAccount(service);
        const own = service.envFor('antigravity', undefined, env);
        const other = service.envFor('antigravity', work, env);

        agy.signIn(own, 'private@example.com');
        agy.signIn(other, 'work@example.com');
        agy.signOut(other);

        expect(agy.whoIs(own)).toBeNull();
    });

    test("a check gives the default account's folder the hooks and the person's skills and rules", async () => {
        const defaultHome = join(dir, 'host', 'accounts', 'antigravity');
        const service = await make(createAntigravityProvider({ defaultHome }));

        await service.refresh();

        expect(installs).toEqual([`antigravity ${defaultHome}`]);
        expect(await readlink(join(defaultHome, 'config', 'skills'))).toBe(join(dir, 'person', '.gemini', 'config', 'skills'));
        expect(await readlink(join(defaultHome, 'GEMINI.md'))).toBe(join(dir, 'person', '.gemini', 'GEMINI.md'));
    });

    test("without a default home the default account stays in the CLI's own folder, on its keyring", async () => {
        const service = await make(createAntigravityProvider());

        expect(service.envFor('antigravity', undefined, env)).toEqual(env);
    });
});
