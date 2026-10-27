import { describe, expect, test } from 'bun:test';
import { ModelCatalogDataSchema, type ModelCatalogData } from '@adecore/agent-contracts';
import { ModelCatalog } from './catalog.ts';
import { claudeArgs, claudeEnv, promptPrefix } from './claude.ts';
import { providerFor } from './registry.ts';
import claudeManifest from './claude-models.json' with { type: 'json' };
import antigravityManifest from './antigravity-models.json' with { type: 'json' };
import codexManifest from './codex-models.json' with { type: 'json' };
import copilotManifest from './copilot-models.json' with { type: 'json' };
import grokManifest from './grok-models.json' with { type: 'json' };

const catalog = new ModelCatalog();

describe('ModelCatalog', () => {
    test('lists models with their options and one default', () => {
        const models = catalog.list();
        expect(models.filter((model) => model.isDefault).map((model) => model.slug)).toEqual(['claude-sonnet-5-5']);
        expect(models.find((model) => model.slug === 'claude-fable-5-1')?.options.map((option) => option.id)).toEqual(['effort', 'contextWindow']);
        expect(models.find((model) => model.slug === 'claude-haiku-4-5')?.options[0]).toMatchObject({ type: 'boolean', defaultValue: true });
        expect(models.find((model) => model.slug === 'claude-haiku-5-5')?.options.map((option) => option.id)).toEqual(['effort', 'contextWindow']);
        expect(models.find((model) => model.slug === 'claude-haiku-4-5')?.legacy).toBe(true);
    });

    test('a model carries who made it when the catalog says so, and nothing when it does not', () => {
        const own = new ModelCatalog({
            updatedAt: '2026-10-20T00:00:00.000Z',
            defaultModel: 'a/one',
            profiles: { plain: { options: [], contextWindowTokens: {} } },
            models: [
                { slug: 'a/one', name: 'One', profile: 'plain', vendor: 'Acme' },
                { slug: 'b/two', name: 'Two', profile: 'plain' }
            ]
        });

        expect(own.list().map((model) => model.vendor)).toEqual(['Acme', undefined]);
        expect('vendor' in own.list()[1]!).toBe(false);
        expect(catalog.list().some((model) => model.vendor !== undefined)).toBe(false);
    });

    test('a model says whether it can call tools only when the catalog does', () => {
        const own = new ModelCatalog({
            updatedAt: '2026-10-21T00:00:00.000Z',
            defaultModel: 'a/one',
            profiles: { plain: { options: [], contextWindowTokens: {} } },
            models: [
                { slug: 'a/one', name: 'One', profile: 'plain', tools: true },
                { slug: 'b/two', name: 'Two', profile: 'plain', tools: false },
                { slug: 'c/three', name: 'Three', profile: 'plain' }
            ]
        });

        expect(own.list().map((model) => model.tools)).toEqual([true, false, undefined]);
        expect('tools' in own.list()[2]!).toBe(false);
    });

    test('fast mode is an option of the models that offer it, off by default', () => {
        const options = (slug: string) => catalog.list().find((model) => model.slug === slug)?.options ?? [];

        expect(options('claude-opus-5').find((option) => option.id === 'fastMode')).toMatchObject({ type: 'boolean', defaultValue: false });
        expect(options('claude-sonnet-5').some((option) => option.id === 'fastMode')).toBe(false);
        expect(catalog.normalize({ model: 'opus' }).options.fastMode).toBe(false);
        expect(catalog.normalize({ model: 'sonnet', options: { fastMode: true } }).options.fastMode).toBeUndefined();
    });

    test('normalize resolves aliases, fills defaults and drops unknown options', () => {
        expect(catalog.normalize({ model: 'opus', options: { effort: 'max', bogus: 'x' } })).toEqual({
            model: 'claude-opus-5-5',
            options: { effort: 'max', contextWindow: '1m', fastMode: false }
        });
        expect(catalog.normalize({ model: 'nope' }).model).toBe('claude-sonnet-5-5');
        expect(catalog.normalize(undefined)).toEqual({ model: 'claude-sonnet-5-5', options: { effort: 'high', contextWindow: '200k' } });
        expect(catalog.normalize({ model: 'sonnet', options: { effort: 'wrong' } }).options.effort).toBe('high');
    });

    test('context window follows the option or the fixed size', () => {
        expect(catalog.contextWindowFor(catalog.normalize({ model: 'sonnet' }))).toBe(200000);
        expect(catalog.contextWindowFor(catalog.normalize({ model: 'sonnet', options: { contextWindow: '1m' } }))).toBe(1000000);
        expect(catalog.contextWindowFor(catalog.normalize({ model: 'haiku' }))).toBe(200000);
    });
});

describe('minimum CLI version', () => {
    const shipped = ModelCatalogDataSchema.parse(claudeManifest);

    const withMinimum = (minCliVersion: string): ModelCatalogData => ({
        ...shipped,
        models: shipped.models.map((model, i) => (i === 0 ? { ...model, minCliVersion } : model))
    });

    test('passes through list() and stays absent otherwise', () => {
        const listed = new ModelCatalog(withMinimum('2.1.4')).list();
        expect(listed[0]?.minCliVersion).toBe('2.1.4');
        expect('minCliVersion' in (listed[1] ?? {})).toBe(false);
    });

    test('a malformed minimum fails the schema', () => {
        expect(ModelCatalogDataSchema.safeParse(withMinimum('newer')).success).toBe(false);
        expect(ModelCatalogDataSchema.safeParse(withMinimum('2.1')).success).toBe(true);
    });
});

describe('a catalog swapped in while the host runs', () => {
    const shipped = ModelCatalogDataSchema.parse(claudeManifest);

    const withModel = (updatedAt: string): ModelCatalogData => ({
        ...shipped,
        updatedAt,
        models: [...shipped.models, { slug: 'claude-next', name: 'Claude Next', profile: 'sonnet' }]
    });

    test('every shipped manifest is a catalog a service may hand out', () => {
        for (const manifest of [claudeManifest, codexManifest, grokManifest, copilotManifest, antigravityManifest]) {
            expect(ModelCatalogDataSchema.safeParse(manifest).success).toBe(true);
        }
    });

    test('takes a newer copy and says the models changed', () => {
        const live = new ModelCatalog();
        expect(live.replace(withModel('2099-01-01T00:00:00Z'))).toBe(true);
        expect(live.resolveModel('claude-next')).toBe('claude-next');
        expect(live.replace(withModel('2099-01-01T00:00:00Z'))).toBe(false);
    });

    test('never goes back behind the copy it shipped with', () => {
        const live = new ModelCatalog();
        expect(live.replace(withModel('2000-01-01T00:00:00Z'))).toBe(false);
        expect(live.resolveModel('claude-next')).toBeNull();
    });

    test('refuses a slug that would read as a flag on the command line', () => {
        const bad = { ...shipped, models: [...shipped.models, { slug: '--dangerously-skip-permissions', name: 'x', profile: 'sonnet' }] };
        expect(ModelCatalogDataSchema.safeParse(bad).success).toBe(false);
    });
});

describe('claudeArgs', () => {
    test('maps the selection and the modes to flags', () => {
        const args = claudeArgs({
            selection: { model: 'claude-opus-5', options: { effort: 'xhigh', contextWindow: '1m' } },
            runtimeMode: 'full-access',
            resume: 'abc'
        });

        expect(args.slice(args.indexOf('--model'))).toEqual([
            '--model',
            'claude-opus-5[1m]',
            '--effort',
            'xhigh',
            '--permission-mode',
            'bypassPermissions',
            '--allow-dangerously-skip-permissions',
            '--resume',
            'abc'
        ]);
    });

    test('fast mode travels as the settings blob the CLI opts in with', () => {
        const selection = { model: 'claude-opus-5', options: { effort: 'high', contextWindow: '1m', fastMode: true } };
        const args = claudeArgs({ selection, runtimeMode: 'auto', resume: null });
        expect(args.slice(args.indexOf('--settings'), args.indexOf('--settings') + 2)).toEqual(['--settings', '{"fastMode":true}']);
        expect(
            claudeArgs({ selection: { ...selection, options: { ...selection.options, fastMode: false } }, runtimeMode: 'auto', resume: null })
        ).not.toContain('--settings');
    });

    test("a launch without the configuration of its folder loads the person's settings only", () => {
        const base = { selection: { model: 'claude-sonnet-5', options: {} }, runtimeMode: 'supervised' as const, resume: null, allowedTools: ['Read'] };
        const ignored = claudeArgs({ ...base, projectConfig: false });
        expect(ignored).toContain('--setting-sources=user');
        expect(ignored).toContain('--strict-mcp-config');
        expect(claudeArgs(base)).not.toContain('--setting-sources=user');
        expect(claudeArgs({ ...base, projectConfig: true })).not.toContain('--strict-mcp-config');
    });

    test('supervised has no permission flag and ultrathink goes into the prompt', () => {
        const selection = { model: 'claude-sonnet-5', options: { effort: 'ultrathink', contextWindow: '200k' } };
        const supervised = claudeArgs({ selection, runtimeMode: 'supervised', resume: null });
        expect(supervised).not.toContain('--permission-mode');
        expect(supervised).not.toContain('--effort');
        expect(promptPrefix(selection)).toBe('ultrathink\n\n');
        expect(promptPrefix({ model: 'x', options: { effort: 'high' } })).toBe('');
    });

    test('a 200k pick caps the compact window, since leaving out [1m] does not on a native 1M model', () => {
        expect(claudeEnv({ model: 'claude-fable-5-1', options: { contextWindow: '200k' } })).toEqual({ CLAUDE_CODE_AUTO_COMPACT_WINDOW: '200000' });
        expect(claudeEnv({ model: 'claude-fable-5-1', options: { contextWindow: '1m' } })).toEqual({});
        expect(claudeEnv({ model: 'claude-haiku-4-5', options: { thinking: true } })).toEqual({});
    });

    test('a 200k pick turns auto-compact on, in the one settings blob it shares with fast mode', () => {
        const settingsOf = (options: Record<string, string | boolean>): string | undefined => {
            const args = claudeArgs({ selection: { model: 'claude-opus-5-5', options }, runtimeMode: 'auto', resume: null });
            expect(args.filter((arg) => arg === '--settings').length).toBeLessThanOrEqual(1);

            return args.includes('--settings') ? args[args.indexOf('--settings') + 1] : undefined;
        };

        expect(settingsOf({ contextWindow: '200k' })).toBe('{"autoCompactEnabled":true}');
        expect(settingsOf({ contextWindow: '200k', fastMode: true })).toBe('{"fastMode":true,"autoCompactEnabled":true}');
        expect(settingsOf({ contextWindow: '1m' })).toBeUndefined();
    });

    test('every mode lets the allowed tools through without a prompt, each in the form that swallows no argument', () => {
        const selection = { model: 'claude-sonnet-5', options: {} };

        for (const runtimeMode of ['supervised', 'auto-accept-edits', 'auto', 'full-access'] as const) {
            expect(claudeArgs({ selection, runtimeMode, resume: null, allowedTools: ['Bash(tool *)'] })).toContain('--allowedTools=Bash(tool *)');
        }

        expect(claudeArgs({ selection, runtimeMode: 'auto', resume: null }).some((arg) => arg.startsWith('--allowedTools'))).toBe(false);
    });

    test('adds each folder in the form that swallows no argument', () => {
        const selection = { model: 'claude-sonnet-5', options: {} };
        const args = claudeArgs({ selection, runtimeMode: 'auto', resume: null, folders: ['/brand/kit', '/shared/assets'] });
        expect(args.filter((arg) => arg.startsWith('--add-dir'))).toEqual(['--add-dir=/brand/kit', '--add-dir=/shared/assets']);
        expect(claudeArgs({ selection, runtimeMode: 'auto', resume: null }).some((arg) => arg.startsWith('--add-dir'))).toBe(false);
    });
});

describe('ignoresProjectConfig', () => {
    test('only Claude Code can run without the configuration of its folder', () => {
        expect(providerFor('claude').ignoresProjectConfig).toBe(true);
        expect(providerFor('codex').ignoresProjectConfig).toBe(false);
        expect(providerFor('opencode' as never).ignoresProjectConfig).toBeUndefined();
    });
});

test('an adopted model that names its context window has that size, and one that names none keeps the host default', () => {
    const catalog = new ModelCatalog({
        defaultModel: 'default',
        profiles: { agent: { options: [], contextWindowTokens: { '*': 64000 } } },
        models: [{ slug: 'default', name: 'Default', profile: 'agent' }]
    });

    catalog.adopt(
        [
            { slug: 'wide', name: 'Wide', contextWindow: 256000 },
            { slug: 'plain', name: 'Plain' }
        ],
        'wide'
    );

    expect(catalog.contextWindowFor(catalog.normalize({ model: 'wide' }))).toBe(256000);
    expect(catalog.contextWindowFor(catalog.normalize({ model: 'plain' }))).toBe(64000);
    catalog.adopt([{ slug: 'plain', name: 'Plain' }], 'plain');
    expect(catalog.contextWindowFor(catalog.normalize({ model: 'plain' }))).toBe(64000);
});

describe('what an agent reported over a catalog', () => {
    const base = (updatedAt: string, names: Record<string, string> = {}): ModelCatalogData => ({
        updatedAt,
        defaultModel: 'default',
        profiles: {
            agent: { options: [], contextWindowTokens: {} },
            wide: { options: [{ id: 'fast', label: 'Fast', type: 'boolean', defaultValue: false }], contextWindowTokens: { '*': 256000 } }
        },
        models: [
            { slug: 'default', name: 'Default', profile: 'agent' },
            { slug: 'known', name: names.known ?? 'Known', badge: 'New', legacy: true, profile: 'wide' }
        ]
    });
    const effort = {
        id: 'effort',
        label: 'Reasoning',
        type: 'select' as const,
        defaultChoice: 'high',
        choices: [{ id: 'high', label: 'High' }]
    };

    test('a newer catalog keeps the models the agent reported', () => {
        const catalog = new ModelCatalog(base('2026-10-01T00:00:00Z'));
        catalog.adopt(
            [
                { slug: 'known', name: 'known' },
                { slug: 'other', name: 'Other' }
            ],
            'other'
        );

        expect(catalog.replace(base('2026-10-02T00:00:00Z', { known: 'Known Renamed' }))).toBe(true);
        expect(catalog.list().map((model) => [model.slug, model.name, model.isDefault])).toEqual([
            ['known', 'Known Renamed', false],
            ['other', 'Other', true]
        ]);
    });

    test('a model the base knows takes its name, badge, legacy flag and profile, with the reported options over them', () => {
        const catalog = new ModelCatalog(base('2026-10-01T00:00:00Z'));
        catalog.adopt([{ slug: 'known', name: 'known', contextWindow: 64000 }], 'known', [effort]);

        expect(catalog.list()).toEqual([
            {
                slug: 'known',
                name: 'Known',
                badge: 'New',
                legacy: true,
                isDefault: true,
                options: [{ id: 'fast', label: 'Fast', type: 'boolean', defaultValue: false }, effort]
            }
        ]);
        expect(catalog.contextWindowFor(catalog.normalize({ model: 'known' }))).toBe(256000);
    });

    test('a model the base does not know keeps the profile of the base default and its reported size', () => {
        const catalog = new ModelCatalog(base('2026-10-01T00:00:00Z'));
        catalog.adopt([{ slug: 'other', name: 'Other', contextWindow: 64000 }], 'other', [effort]);

        expect(catalog.list()[0]).toMatchObject({ slug: 'other', name: 'Other', legacy: false, options: [effort] });
        expect(catalog.contextWindowFor(catalog.normalize({ model: 'other' }))).toBe(64000);
    });

    test('adopting after a replace reads the replaced base', () => {
        const catalog = new ModelCatalog(base('2026-10-01T00:00:00Z'));
        catalog.replace(base('2026-10-02T00:00:00Z', { known: 'Known Renamed' }));
        catalog.adopt([{ slug: 'known', name: 'known' }], 'known');

        expect(catalog.nameOf('known')).toBe('Known Renamed');
        expect(catalog.resolveModel('default')).toBeNull();
    });

    test('without an adopted list a replace swaps the whole catalog', () => {
        const catalog = new ModelCatalog(base('2026-10-01T00:00:00Z'));
        const next = base('2026-10-02T00:00:00Z', { known: 'Known Renamed' });
        catalog.replace(next);

        expect(catalog.list().map((model) => model.name)).toEqual(['Default', 'Known Renamed']);
        expect(catalog.defaultModel).toBe('default');
    });
});
