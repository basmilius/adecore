import { z } from 'zod';
import { AgentKindSchema, type AgentKind } from './agent.ts';

// Options a model exposes (effort, context window, thinking). Generic descriptors instead of
// per-provider enums: a new model is a catalog entry, not a code change.
export const ModelOptionChoiceSchema = z.object({
    id: z.string().min(1),
    label: z.string(),
    description: z.string().optional()
});
export type ModelOptionChoice = z.infer<typeof ModelOptionChoiceSchema>;

export const ModelOptionDescriptorSchema = z.discriminatedUnion('type', [
    z.object({
        id: z.string().min(1),
        label: z.string(),
        type: z.literal('select'),
        choices: z.array(ModelOptionChoiceSchema).min(1),
        defaultChoice: z.string()
    }),
    z.object({
        id: z.string().min(1),
        label: z.string(),
        type: z.literal('boolean'),
        defaultValue: z.boolean(),
        // The line under the label in the picker: what turning it on costs or asks for.
        description: z.string().optional()
    })
]);
export type ModelOptionDescriptor = z.infer<typeof ModelOptionDescriptorSchema>;

export const ModelInfoSchema = z.object({
    slug: z.string().min(1),
    name: z.string(),
    badge: z.string().optional(),
    // Who made the model, for a provider that offers many: the picker groups by it. Absent when the provider does not say.
    vendor: z.string().optional(),
    legacy: z.boolean(),
    isDefault: z.boolean(),
    options: z.array(ModelOptionDescriptorSchema),
    // The oldest CLI that offers this model; absent when no minimum is known.
    minCliVersion: z.string().optional(),
    // Whether the model can call tools, for a provider whose models differ in that. Absent when the provider does not say.
    tools: z.boolean().optional()
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const ModelSelectionSchema = z.object({
    model: z.string().min(1),
    options: z.record(z.string(), z.union([z.string(), z.boolean()]))
});
export type ModelSelection = z.infer<typeof ModelSelectionSchema>;

// A slug ends up on a CLI's command line, so it never starts with a dash and carries no brackets.
const ModelSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, 'Expected a model slug');

export const ModelCatalogProfileSchema = z.object({
    options: z.array(ModelOptionDescriptorSchema),
    // Context size per value of the `contextWindow` option, or `*` when the model has one size.
    contextWindowTokens: z.record(z.string(), z.number().int().positive())
});
export type ModelCatalogProfile = z.infer<typeof ModelCatalogProfileSchema>;

export const ModelCatalogEntrySchema = z.object({
    slug: ModelSlugSchema,
    name: z.string().min(1),
    badge: z.string().optional(),
    vendor: z.string().optional(),
    profile: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    legacy: z.boolean().optional(),
    minCliVersion: z
        .string()
        .regex(/^\d+\.\d+(\.\d+)?$/, 'Expected a version such as 2.1 or 2.1.4')
        .optional(),
    tools: z.boolean().optional()
});
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntrySchema>;

/*
 * The models one provider offers, as a host ships them and as a catalog service hands out a newer
 * copy. `updatedAt` orders the two, so a copy older than the one a host shipped with is never taken.
 */
export const ModelCatalogDataSchema = z
    .object({
        updatedAt: z.iso.datetime(),
        defaultModel: ModelSlugSchema,
        profiles: z.record(z.string(), ModelCatalogProfileSchema),
        models: z.array(ModelCatalogEntrySchema).min(1)
    })
    .refine((data) => data.models.every((model) => data.profiles[model.profile] !== undefined), 'Every model needs a profile the catalog has')
    .refine((data) => data.models.some((model) => model.slug === data.defaultModel), 'The default model has to be one of the models');
export type ModelCatalogData = z.infer<typeof ModelCatalogDataSchema>;

// The thread's permission policy, one vocabulary for every provider; each adapter maps it.
export const RuntimeModeSchema = z.enum(['supervised', 'auto-accept-edits', 'auto', 'full-access']);
export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;

// What a provider's CLI can do, so a client never offers what it would drop and the daemon
// never asks for what the protocol has no room for. Read by the composer and the thread rows.
export const ProviderCapabilitiesSchema = z.object({
    // Where this CLI can be opened: as a chat node, as a terminal node, or both.
    chat: z.boolean(),
    terminal: z.boolean(),
    // Whether the daemon understands this CLI's hooks; without them a node shows the session status only.
    hooks: z.boolean(),
    // Partial output while a tool call runs, for the live row under it.
    streamsToolOutput: z.boolean(),
    // How a file change reaches the thread: as a unified diff, as the text before and after, or not at all.
    diffs: z.enum(['unified', 'before-after', 'none']),
    attachments: z.boolean(),
    mentions: z.boolean(),
    // Whether a decline carries a reason for the agent.
    denyReason: z.boolean(),
    allowAlways: z.boolean(),
    // A question the person may leave alone while the turn goes on.
    asyncQuestions: z.boolean(),
    // Whether a message sent while a turn runs can join that turn rather than wait for the next;
    // absent where it cannot, which is also what a host from before this field reports.
    steer: z.boolean().optional(),
    // Folding the context: a call of its own, a slash command sent as a turn, or nothing.
    compaction: z.enum(['native', 'prompt', 'none']),
    reportsCost: z.boolean(),
    reportsContextWindow: z.boolean(),
    // Whether the CLI hands over what the model thought before it answered.
    reportsThinking: z.boolean(),
    slashCommands: z.boolean(),
    // How `/goal` reaches the CLI: through a protocol of its own that pauses, resumes and clears (`native`),
    // or as the slash command alone (`command`); absent where the CLI has no goals.
    goals: z.enum(['native', 'command']).optional()
});
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;

// The systems an install command is written for, by Node's names for them.
export const ProviderPlatformSchema = z.enum(['darwin', 'linux', 'win32']);
export type ProviderPlatform = z.infer<typeof ProviderPlatformSchema>;

// One way a CLI signs in once it is installed.
export const ProviderSignInSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('command'), command: z.string() }),
    z.object({ kind: z.literal('env'), variable: z.string() }),
    z.object({ kind: z.literal('chat') })
]);
export type ProviderSignIn = z.infer<typeof ProviderSignInSchema>;

// How a person gets a CLI that is not on the machine yet.
export const ProviderInstallSchema = z.object({
    // One line on what the CLI is.
    description: z.string(),
    // A system without a command is one the CLI does not install on in one line.
    commands: z.object({ darwin: z.string().optional(), linux: z.string().optional(), win32: z.string().optional() }),
    guideUrl: z.string().optional(),
    // In the order the CLI prefers them. A way a newer host names that this version does not know is left out,
    // so it never fails the whole provider.
    signIn: z.array(z.unknown()).transform((ways) =>
        ways.flatMap((way) => {
            const parsed = ProviderSignInSchema.safeParse(way);

            return parsed.success ? [parsed.data] : [];
        })
    )
});
export type ProviderInstall = z.infer<typeof ProviderInstallSchema>;

export const ProviderInfoSchema = z.object({
    kind: AgentKindSchema,
    name: z.string(),
    installed: z.boolean(),
    version: z.string().nullable(),
    // Empty while the CLI is not installed or has no chat backend yet.
    models: z.array(ModelInfoSchema),
    defaultModel: z.string().nullable(),
    capabilities: ProviderCapabilitiesSchema,
    // What a terminal runs to continue one of this CLI's sessions. `{id}` stands for the session id
    // and `{flags}` for the flags the launch carries, which is where in the line each CLI takes them.
    resumeCommand: z.string(),
    // Absent from a host that knows no way to install this CLI, and from one older than this field.
    install: ProviderInstallSchema.optional()
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

// The CLIs of the labs that train their own frontier models; a picker lists them before every other provider.
export const FRONTIER_PROVIDER_KINDS: ReadonlySet<AgentKind> = new Set(['claude', 'codex']);

// Providers billed per key rather than a CLI's own sign-in; a picker lists them last. Named, since an agent of
// the ACP registry has no terminal either.
export const API_PROVIDER_KINDS: ReadonlySet<AgentKind> = new Set(['anthropic-claude-api', 'nanogpt']);

export type ProviderPickerGroup = 'frontier' | 'others' | 'api';

export interface ProviderPickerGroups<T> {
    frontier: T[];
    others: T[];
    api: T[];
}

export function providerGroupOf(kind: AgentKind): ProviderPickerGroup {
    return FRONTIER_PROVIDER_KINDS.has(kind) ? 'frontier' : API_PROVIDER_KINDS.has(kind) ? 'api' : 'others';
}

let nameCollator: Intl.Collator | null = null;

/* The providers in the three groups of a picker, each by name. Names are proper names, so the runtime locale sorts them. */
export function pickerGroupsOf<T extends { kind: AgentKind; name: string }>(providers: readonly T[]): ProviderPickerGroups<T> {
    nameCollator ??= new Intl.Collator(undefined, { sensitivity: 'base' });
    const collator = nameCollator;
    const sorted = [...providers].sort((a, b) => collator.compare(a.name, b.name));

    const inGroup = (group: ProviderPickerGroup): T[] => sorted.filter((provider) => providerGroupOf(provider.kind) === group);

    return { frontier: inGroup('frontier'), others: inGroup('others'), api: inGroup('api') };
}

export const ProviderListResultSchema = z.object({
    providers: z.array(ProviderInfoSchema)
});
export type ProviderListResult = z.infer<typeof ProviderListResultSchema>;

/*
 * Fills a provider's resume template; the id is quoted so a shell takes it as one word. `{flags}` is
 * a word of its own rather than a substring, since it stands for none, one or several words and a
 * substitution would leave a double space behind where a launch carries no flags at all.
 */
export function resumeCommandFor(template: string, agentSessionId: string, flags: string[] = []): string {
    const id = `'${agentSessionId.replaceAll("'", `'\\''`)}'`;

    return template
        .split(' ')
        .flatMap((word) => (word === '{flags}' ? flags : [word.replace('{id}', id)]))
        .join(' ');
}
