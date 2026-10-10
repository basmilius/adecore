import { addTotals, EMPTY_TOTALS, totalTokensOf } from '@adecore/agent-contracts';
import type {
    UsageBucket,
    UsageModel,
    UsagePriceBasis,
    UsageProject,
    UsageProvider,
    UsageResolution,
    UsageSummaryPayload,
    UsageTotals
} from '@adecore/agent-contracts';
import { cacheSavingsOf, costOf, type ModelPrice, type PriceBook, type PriceLookup } from './pricing.ts';
import { ProjectResolver, type KnownProject } from './projects.ts';
import type { UsageRecord } from './record.ts';

export interface Aggregation {
    buckets: UsageBucket[];
    models: UsageModel[];
    projects: UsageProject[];
    sessions: number;
}

/*
 * The calendar day a moment falls in, as the viewer's clock reads it. The host may stand in
 * another zone than the person looking, so the zone travels with the request and every boundary
 * here is local wall clock, never UTC.
 */
function slotFormatter(timeZone: string, resolution: UsageResolution): Intl.DateTimeFormat {
    const options: Intl.DateTimeFormatOptions =
        resolution === 'hour'
            ? { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }
            : { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
    try {
        return new Intl.DateTimeFormat('en-CA', options);
    } catch {
        // A zone this machine does not know degrades to UTC rather than failing the whole request.
        return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' });
    }
}

/* `2026-09-10` for a day, `2026-09-10T14` for an hour: the day is always the first ten characters. */
function slotOf(format: Intl.DateTimeFormat, timestampMs: number, resolution: UsageResolution): string {
    const parts = format.formatToParts(new Date(timestampMs));
    const at = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
    const day = `${at('year')}-${at('month')}-${at('day')}`;
    return resolution === 'hour' ? `${day}T${at('hour')}` : day;
}

function emptyTotals(): UsageTotals {
    return { ...EMPTY_TOTALS };
}

interface BucketAccumulator {
    slot: string;
    provider: UsageProvider;
    model: string;
    account: string | null;
    totals: UsageTotals;
    costUsd: number;
    priced: boolean;
    cacheSavingsUsd: number;
    sessions: Set<string>;
}

interface ModelAccumulator {
    provider: UsageProvider;
    model: string;
    account: string | null;
    totals: UsageTotals;
    costUsd: number;
    priced: boolean;
}

interface ProjectAccumulator {
    folder: string;
    name: string;
    projectId: string | null;
    byProvider: Map<UsageProvider, { costUsd: number; tokens: number }>;
    totals: UsageTotals;
    costUsd: number;
}

interface ModelRow extends ModelAccumulator {
    /* The basis of the first record of a model prices the whole row: a model has one price. */
    basis: UsagePriceBasis;
    pricedAs: string | null;
}

function foldBucket(
    buckets: Map<string, BucketAccumulator>,
    slot: string,
    record: UsageRecord,
    account: string | null,
    price: ModelPrice | null,
    cost: number
): void {
    const key = `${slot}\0${record.provider}\0${record.model}\0${account ?? ''}`;
    let bucket = buckets.get(key);
    if (bucket === undefined) {
        bucket = {
            slot,
            provider: record.provider,
            model: record.model,
            account,
            totals: emptyTotals(),
            costUsd: 0,
            priced: false,
            cacheSavingsUsd: 0,
            sessions: new Set()
        };
        buckets.set(key, bucket);
    }
    bucket.totals = addTotals(bucket.totals, record.totals);
    bucket.costUsd += cost;
    bucket.priced ||= price !== null;
    bucket.cacheSavingsUsd += price === null ? 0 : cacheSavingsOf(record.totals, price);
    if (record.sessionId !== '') {
        bucket.sessions.add(record.sessionId);
    }
}

function foldModel(models: Map<string, ModelRow>, record: UsageRecord, account: string | null, lookup: PriceLookup, cost: number): void {
    const key = `${record.provider}\0${record.model}\0${account ?? ''}`;
    let model = models.get(key);
    if (model === undefined) {
        model = {
            provider: record.provider,
            model: record.model,
            account,
            totals: emptyTotals(),
            costUsd: 0,
            priced: false,
            basis: lookup.basis,
            pricedAs: lookup.pricedAs
        };
        models.set(key, model);
    }
    model.totals = addTotals(model.totals, record.totals);
    model.costUsd += cost;
    model.priced ||= lookup.price !== null;
}

function foldProject(project: ProjectAccumulator, record: UsageRecord, cost: number): void {
    project.totals = addTotals(project.totals, record.totals);
    project.costUsd += cost;
    const share = project.byProvider.get(record.provider) ?? { costUsd: 0, tokens: 0 };
    share.costUsd += cost;
    share.tokens += totalTokensOf(record.totals);
    project.byProvider.set(record.provider, share);
}

/* The account a record was made under, the default one under its CLI's kind. */
export function accountOfRecord(record: UsageRecord): string {
    return record.account ?? record.provider;
}

/*
 * Every record of the period folded three ways at once: per slot for the chart, per model for the
 * breakdown and its price basis, and per folder for the projects. The three cannot be derived from
 * one another without a bucket per slot times model times project, which is a table nobody reads.
 */
export async function aggregate(
    records: readonly UsageRecord[],
    payload: UsageSummaryPayload,
    prices: PriceBook,
    known: readonly KnownProject[]
): Promise<Aggregation> {
    const format = slotFormatter(payload.timeZone, payload.resolution);
    const buckets = new Map<string, BucketAccumulator>();
    const models = new Map<string, ModelRow>();
    const projects = new Map<string, ProjectAccumulator>();
    const sessions = new Set<string>();
    const resolver = new ProjectResolver(known);
    const folders = new Map<string, string>();
    // A filter splits buckets and models per account; without one they fold the way they did before accounts.
    const only = payload.accounts === undefined ? null : new Set(payload.accounts);

    for (const record of records) {
        const account = only === null ? null : accountOfRecord(record);
        if (only !== null && !only.has(account!)) {
            continue;
        }
        const slot = slotOf(format, record.timestampMs, payload.resolution);
        const day = slot.slice(0, 10);
        if (day < payload.from || day > payload.to) {
            continue;
        }
        const lookup = prices.look(record.model);
        const cost = lookup.price === null ? 0 : costOf(record.totals, lookup.price);
        foldBucket(buckets, slot, record, account, lookup.price, cost);
        foldModel(models, record, account, lookup, cost);
        if (record.sessionId !== '') {
            sessions.add(`${record.provider}\0${record.sessionId}`);
        }

        let folder = folders.get(record.cwd);
        if (folder === undefined) {
            const resolved = await resolver.resolve(record.cwd);
            folder = resolved.folder;
            folders.set(record.cwd, folder);
            if (!projects.has(folder)) {
                projects.set(folder, { folder, name: resolved.name, projectId: resolved.projectId, byProvider: new Map(), totals: emptyTotals(), costUsd: 0 });
            }
        }
        foldProject(projects.get(folder)!, record, cost);
    }

    return {
        buckets: [...buckets.values()]
            .map((bucket) => ({
                slot: bucket.slot,
                provider: bucket.provider,
                model: bucket.model,
                ...(bucket.account === null ? {} : { account: bucket.account }),
                totals: bucket.totals,
                costUsd: bucket.priced ? bucket.costUsd : null,
                cacheSavingsUsd: bucket.cacheSavingsUsd,
                sessions: bucket.sessions.size
            }))
            .sort(
                (a, b) =>
                    a.slot.localeCompare(b.slot) ||
                    a.provider.localeCompare(b.provider) ||
                    a.model.localeCompare(b.model) ||
                    (a.account ?? '').localeCompare(b.account ?? '')
            ),
        models: [...models.values()]
            .map((model) => ({
                provider: model.provider,
                model: model.model,
                ...(model.account === null ? {} : { account: model.account }),
                totals: model.totals,
                costUsd: model.priced ? model.costUsd : null,
                priceBasis: model.basis,
                pricedAs: model.pricedAs
            }))
            .sort((a, b) => (b.costUsd ?? -1) - (a.costUsd ?? -1)),
        projects: [...projects.values()]
            .map((project) => ({
                folder: project.folder,
                name: project.name,
                projectId: project.projectId,
                byProvider: Object.fromEntries(project.byProvider),
                totals: project.totals,
                costUsd: project.costUsd
            }))
            .sort((a, b) => b.costUsd - a.costUsd),
        sessions: sessions.size
    };
}
