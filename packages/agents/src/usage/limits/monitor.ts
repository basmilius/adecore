import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { USAGE_PROVIDERS, UsageLimitsProviderSchema, type UsageLimitsProvider, type UsageLimitsSnapshot, type UsageProvider } from '@adecore/agent-contracts';
import { isNotFound } from '@adecore/utils/errors';
import { writeAtomic } from '@adecore/utils/fs';
import { z } from 'zod';
import type { CodexClientInfo } from '../../chat/codex-transport.ts';
import { ClientSinks } from '../../client-sinks.ts';
import { errorText } from '../../error-text.ts';
import type { AgentEvent, AgentSink } from '../../events.ts';
import { definedEnv } from '../../providers/accounts/launch.ts';
import type { ProviderRegistry } from '../../providers/registry.ts';
import { mergeWindows, type LimitsUpdate } from './normalize.ts';
import { probeClaude, probeCodex, type ProbeResult } from './probe.ts';

/* Often enough that a bar is never far behind, rarely enough that two CLIs are not started all day. */
const PROBE_INTERVAL_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;
/* An account other than the default one that nobody started a CLI under for this long is read only while a usage page is open, or when a person asks. */
const RECENT_USE_MS = 24 * 60 * 60_000;

const PROVIDERS: readonly UsageProvider[] = USAGE_PROVIDERS;
/* The CLIs the probes know how to ask; any other provider has a plan only through the host's `plans`. */
const PROBED: readonly UsageProvider[] = ['claude', 'codex'];

const KeptLimitsSchema = z.object({
    version: z.literal(1),
    accounts: z.record(z.string(), UsageLimitsProviderSchema.omit({ account: true }))
});

/* Where a host keeps the last plan numbers, beside the rest of its usage. */
export function limitsFileIn(home: string): string {
    return join(home, 'usage', 'limits.json');
}

export type ProbeEnv = Record<string, string>;

/* An account whose plan is read. The default account of a CLI has the CLI's kind as its id. */
export interface LimitAccount {
    id: string;
    kind: UsageProvider;
    label: string;
    color?: string;
    isDefault: boolean;
}

export interface LimitAccounts {
    /* The default account of every CLI, and every other account that is on and signed in. */
    list(): LimitAccount[];
    /* The environment a probe of this account runs in. Throws for an account this machine cannot start. */
    envFor(kind: UsageProvider, id: string): ProbeEnv;
    /* When a chat or a terminal last started under this account; null when none did since the host started. */
    lastUsedAt(id: string): number | null;
}

interface ProviderState {
    kind: UsageProvider;
    published: UsageLimitsProvider;
    /* How long to wait after a failure; it doubles up to an hour and resets on the first answer. */
    backoffMs: number;
    nextAt: number;
    /* Counts the numbers a running turn reported, so a read that started before one does not replace it. */
    liveRevision: number;
}

function blank(kind: UsageProvider): UsageLimitsProvider {
    return {
        kind,
        plan: null,
        checkedAt: 0,
        source: 'probe',
        windows: [],
        cost: null,
        unavailable: null
    };
}

export interface UsageMonitorOptions {
    providers: ProviderRegistry;
    /* The accounts to read; absent reads the default account of every CLI and names none. */
    accounts?: LimitAccounts;
    probe?: (kind: UsageProvider, command: readonly string[], env: ProbeEnv) => Promise<ProbeResult>;
    /*
     * A plan the host reads itself, for a provider whose CLI cannot be asked (a subscription API the host calls,
     * or a billing endpoint only the CLI's interface shows). It answers in place of the probe, once per account,
     * with no environment and no check that a CLI is installed: what it says is the whole story, a missing key included.
     */
    plans?: Partial<Record<UsageProvider, (account: LimitAccount) => Promise<ProbeResult>>>;
    now?: () => number;
    // How the host names itself to the app-server a probe opens.
    client?: CodexClientInfo;
    /* Where the last numbers of every account are kept, so a restarted host shows them until its first read; absent keeps none. */
    file?: string;
}

/*
 * What is left of each plan, per account. Two sources feed it: a read of our own every five minutes,
 * which starts the CLI, asks and ends it, and the events a running turn streams in between, which
 * cost nothing and arrive the moment a number moves. Neither reads a credential: both CLIs already
 * hold their own login and answer the question themselves. A provider without a CLI is read by the
 * host that holds its key (`plans`), on the same clock.
 */
export class UsageMonitor {
    private readonly registry: ProviderRegistry;
    private readonly accounts: LimitAccounts | null;
    private readonly probe: NonNullable<UsageMonitorOptions['probe']>;
    private readonly plans: NonNullable<UsageMonitorOptions['plans']>;
    private readonly now: () => number;
    private readonly file: string | null;
    private readonly sinks = new ClientSinks<AgentEvent>((clientId) => this.unwatch(clientId));
    // The clients with a usage page open, which is what lets an account nobody uses here be read.
    private readonly watchers = new Set<string>();
    // By account id, so the default account of a CLI is under the CLI's kind.
    private readonly states = new Map<string, ProviderState>();
    private inFlight: Promise<void> | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private saving: Promise<void> = Promise.resolve();
    private saveQueued = false;
    private forcedPass = false;
    private queuedForce: Promise<void> | null = null;

    constructor(options: UsageMonitorOptions) {
        this.registry = options.providers;
        this.accounts = options.accounts ?? null;
        this.plans = options.plans ?? {};
        this.probe = options.probe ?? ((kind, command, env) => (kind === 'claude' ? probeClaude(command, env) : probeCodex(command, env, options.client)));
        this.now = options.now ?? Date.now;
        this.file = options.file ?? null;

        for (const kind of PROVIDERS) {
            this.stateOf(kind, kind);
        }
    }

    subscribe(clientId: string, sink: AgentSink): () => void {
        return this.sinks.subscribe(clientId, sink);
    }

    /*
     * A usage page opened on this client. While one is open anywhere, the pass also reads the accounts nobody
     * used here; the first page reads them at once, as far as their clock and backoff allow.
     */
    watch(clientId: string): void {
        const first = this.watchers.size === 0;
        this.watchers.add(clientId);

        if (first) {
            void this.refresh(false);
        }
    }

    /* The page closed, or the client went. */
    unwatch(clientId: string): void {
        this.watchers.delete(clientId);
    }

    /* Per CLI its default account first, in the shape an entry had before accounts, then its other accounts. */
    snapshot(): UsageLimitsSnapshot {
        const providers = this.listed().map(({ id, kind, label, color }) => {
            const published = this.stateOf(kind, id).published;

            return this.accounts === null ? published : { ...published, account: { id, label, ...(color === undefined ? {} : { color }) } };
        });

        return { providers };
    }

    /* Starts the five minute pass. The kept numbers come back first and the first read runs at once, so a fresh host has numbers. */
    start(): void {
        this.timer ??= setInterval(() => void this.refresh(false), PROBE_INTERVAL_MS);
        void this.restore().then(() => this.refresh(false));
    }

    /* Resolves once the last numbers are on disk. */
    stop(): Promise<void> {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }

        return this.saving;
    }

    /* The numbers the previous host kept, on every account no read or turn has drawn yet. */
    async restore(): Promise<void> {
        if (this.file === null) {
            return;
        }

        let text: string;

        try {
            text = await readFile(this.file, 'utf8');
        } catch (e) {
            if (!isNotFound(e)) {
                console.warn(`[usage] the kept plan limits would not read: ${errorText(e)}`);
            }

            return;
        }

        const kept = KeptLimitsSchema.safeParse(safeJson(text));

        // Numbers from an older or broken file are not worth an error; the first read draws new ones.
        if (!kept.success) {
            return;
        }

        let changed = false;

        for (const [id, published] of Object.entries(kept.data.accounts)) {
            const state = this.stateOf(published.kind, id);

            if (state.published.checkedAt === 0) {
                state.published = published;
                changed = true;
            }
        }

        if (changed) {
            this.sinks.emit({ event: 'usage.limitsChanged', payload: this.snapshot() });
        }
    }

    /* A force request cannot inherit the eligibility of a normal pass already in progress. */
    refresh(force: boolean): Promise<void> {
        if (this.queuedForce !== null) {
            return this.queuedForce;
        }

        if (this.inFlight === null) {
            return this.begin(force);
        }

        if (!force || this.forcedPass) {
            return this.inFlight;
        }

        this.queuedForce = this.inFlight
            .catch(() => undefined)
            .then(() => this.begin(true))
            .finally(() => {
                this.queuedForce = null;
            });

        return this.queuedForce;
    }

    private begin(force: boolean): Promise<void> {
        this.forcedPass = force;
        this.inFlight = this.runAll(force).finally(() => {
            this.inFlight = null;
        });

        return this.inFlight;
    }

    /* An account came, went, was renamed or signed in: the list a client holds is drawn again. */
    accountsChanged(): void {
        this.emit();
    }

    /*
     * A number a running turn reported, on the account the turn ran under. It lands on the row a full
     * read drew, keeping the reset and the length the event leaves out, so the bar moves without
     * waiting for the next pass.
     */
    applyLive(update: LimitsUpdate): void {
        if (update.windows.length === 0) {
            return;
        }

        const state = this.stateOf(update.kind, update.account ?? update.kind);

        state.liveRevision += 1;
        state.published = {
            ...state.published,
            plan: update.plan ?? state.published.plan,
            checkedAt: this.now(),
            source: 'event',
            windows: mergeWindows(state.published.windows, update.windows),
            unavailable: null
        };

        this.emit();
    }

    /* Every account of a CLI whose plan is read, the default one first. */
    private listed(): LimitAccount[] {
        const accounts = this.accounts?.list() ?? PROVIDERS.map((kind) => ({ id: kind, kind, label: kind, isDefault: true }));

        return PROVIDERS.flatMap((kind) => {
            if (!PROBED.includes(kind) && this.plans[kind] === undefined) {
                return [];
            }

            const own = accounts.filter((account) => account.kind === kind);

            return [...own.filter((account) => account.isDefault), ...own.filter((account) => !account.isDefault)];
        });
    }

    private stateOf(kind: UsageProvider, id: string): ProviderState {
        let state = this.states.get(id);

        if (state === undefined || state.kind !== kind) {
            state = { kind, published: blank(kind), backoffMs: PROBE_INTERVAL_MS, nextAt: 0, liveRevision: 0 };
            this.states.set(id, state);
        }

        return state;
    }

    /*
     * The default account on the clock; another only while it is in use or a usage page is open, since every
     * read starts its CLI. A restart forgets which accounts were in use, so until one is used again or a page
     * opens it shows the numbers kept in `file`.
     */
    private due(account: LimitAccount, state: ProviderState, force: boolean): boolean {
        if (force) {
            return true;
        }

        if (this.now() < state.nextAt) {
            return false;
        }

        if (account.isDefault || this.watchers.size > 0) {
            return true;
        }

        const used = this.accounts?.lastUsedAt(account.id) ?? null;

        return used !== null && this.now() - used < RECENT_USE_MS;
    }

    private async runAll(force: boolean): Promise<void> {
        const listedRevisions = new Map(this.listed().map(({ id, kind }) => [id, this.stateOf(kind, id).liveRevision]));
        const installed = await this.registry.list();
        let changed = false;

        for (const account of this.listed()) {
            const { kind } = account;
            const state = this.stateOf(kind, account.id);

            if (!this.due(account, state, force)) {
                continue;
            }

            const info = installed.find((provider) => provider.kind === kind);

            if (this.plans[kind] === undefined && (info === undefined || !info.installed)) {
                state.nextAt = this.now() + PROBE_INTERVAL_MS;

                if (state.liveRevision !== (listedRevisions.get(account.id) ?? 0)) {
                    continue;
                }

                state.published = { ...blank(kind), checkedAt: this.now(), unavailable: { reason: 'not-installed', message: null } };
                changed = true;

                continue;
            }

            // The next read is counted from when this one started, so a read that takes a few seconds does not push the tick of the clock past its time.
            const startedAt = this.now();
            const liveRevision = state.liveRevision;
            const result = await this.read(account);
            const failed = 'unavailable' in result && result.unavailable?.reason === 'failed';
            state.backoffMs = failed ? Math.min(MAX_BACKOFF_MS, state.backoffMs * 2) : PROBE_INTERVAL_MS;
            state.nextAt = startedAt + state.backoffMs;

            if (liveRevision !== state.liveRevision) {
                continue;
            }

            if (failed && 'unavailable' in result && state.published.windows.length > 0) {
                state.published = { ...state.published, unavailable: result.unavailable };
                changed = true;

                continue;
            }

            state.published =
                'unavailable' in result
                    ? { ...blank(kind), checkedAt: this.now(), unavailable: result.unavailable }
                    : { kind, plan: result.plan, checkedAt: this.now(), source: 'probe', windows: result.windows, cost: result.cost, unavailable: null };

            changed = true;
        }

        if (changed) {
            this.emit();
        }
    }

    private async read(account: LimitAccount): Promise<ProbeResult> {
        const plan = this.plans[account.kind];

        if (plan !== undefined) {
            try {
                return await plan(account);
            } catch (e) {
                return { unavailable: { reason: 'failed', message: errorText(e) } };
            }
        }

        let env: ProbeEnv;

        try {
            env = this.accounts === null ? definedEnv(process.env) : this.accounts.envFor(account.kind, account.id);
        } catch (e) {
            return { unavailable: { reason: 'failed', message: errorText(e) } };
        }

        return this.probe(account.kind, this.registry.get(account.kind).command, env);
    }

    private emit(): void {
        this.sinks.emit({ event: 'usage.limitsChanged', payload: this.snapshot() });
        this.save();
    }

    /* One write at a time; changes that arrive meanwhile land together in the next one. */
    private save(): void {
        if (this.file === null || this.saveQueued) {
            return;
        }

        const file = this.file;
        this.saveQueued = true;

        this.saving = this.saving.then(async () => {
            this.saveQueued = false;

            try {
                await mkdir(dirname(file), { recursive: true });
                await writeAtomic(file, JSON.stringify(this.kept()), 0o600);
            } catch (e) {
                console.warn(`[usage] the plan limits would not keep: ${errorText(e)}`);
            }
        });
    }

    /* The numbers worth showing after a restart: those of every listed account that has any. */
    private kept(): z.infer<typeof KeptLimitsSchema> {
        const accounts: Record<string, UsageLimitsProvider> = {};

        for (const { id, kind } of this.listed()) {
            const { published } = this.stateOf(kind, id);

            if (published.windows.length > 0) {
                accounts[id] = published;
            }
        }

        return { version: 1, accounts };
    }
}

function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
