/* Data for the chart demos: made up, but shaped like what a service reports. Seeded, so every render draws the same. */
import { formatRounded } from '@adecore/ui/format';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/* The first hour of the day the demos show, in the reader's own time zone. */
const START = new Date(2026, 9, 23).getTime();

function noise(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
}

export interface HourBucket {
    readonly at: number;
    readonly errors: number | null;
    readonly warnings: number | null;
}

/* The stretch the collector was down: no buckets reported between these hours. */
export const GAP = { start: START + 9 * HOUR, end: START + 12 * HOUR };

export const DEPLOY = { at: START + 14 * HOUR + 37 * 60_000, version: 'v2.4.0' };

/* Errors and warnings per hour over a day: quiet at night, a spike after the deploy, nothing while the collector was down. */
export function errorsPerHour(): HourBucket[] {
    return Array.from({ length: 24 }, (_, hour) => {
        const at = START + hour * HOUR;
        if (at >= GAP.start && at < GAP.end) {
            return { at, errors: null, warnings: null };
        }

        const day = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 0.5 + 0.5;
        const spike = hour === 15 ? 38 : hour === 16 ? 21 : hour === 17 ? 9 : 0;

        return {
            at,
            errors: Math.round(4 + day * 14 + noise(hour) * 5 + spike),
            warnings: Math.round(10 + day * 22 + noise(hour + 40) * 8 + spike / 3)
        };
    });
}

export interface RunBucket {
    readonly at: number;
    readonly succeeded: number | null;
    readonly failed: number | null;
}

/* Runs of a job per hour over the same day, and the ones that failed, with more failures right after the deploy. */
export function runsPerHour(): RunBucket[] {
    return Array.from({ length: 24 }, (_, hour) => {
        const at = START + hour * HOUR;
        if (at >= GAP.start && at < GAP.end) {
            return { at, succeeded: null, failed: null };
        }

        const day = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 0.5 + 0.5;
        const failed = hour === 15 ? 14 : hour === 16 ? 6 : Math.round(noise(hour + 70) * 3);

        return { at, succeeded: Math.round(20 + day * 40 + noise(hour + 90) * 10), failed };
    });
}

export interface TransactionBucket {
    readonly at: number;
    /* Milliseconds. */
    readonly p50: number | null;
    readonly p95: number | null;
    readonly succeeded: number;
    readonly failed: number;
}

/* Two deploys of a service: the first slows one endpoint down and fails some of its runs, the second fixes it. */
export const TRANSACTION_DEPLOYS = [
    { at: START + 13 * HOUR + 12 * 60_000, version: 'v3.8.0' },
    { at: START + 16 * HOUR + 41 * 60_000, version: 'v3.8.1' }
];

/* One endpoint over a day in buckets of 30 minutes: its p50 and p95 duration and its runs, quiet at night. */
export function transactionPerHalfHour(): TransactionBucket[] {
    return Array.from({ length: 48 }, (_, slot) => {
        const at = START + slot * 30 * 60_000;
        const hour = slot / 2;
        const day = Math.sin(((hour - 7) / 24) * Math.PI * 2) * 0.5 + 0.5;
        const runs = Math.round(6 + day * 140 + noise(slot + 300) * 25);
        const slow = at >= TRANSACTION_DEPLOYS[0]!.at - 30 * 60_000 && at < TRANSACTION_DEPLOYS[1]!.at;
        const failed = slow ? Math.round(runs * (0.06 + noise(slot + 400) * 0.05)) : Math.round(noise(slot + 500) * 2.4);

        if (runs < 12 && noise(slot + 600) > 0.6) {
            return { at, p50: null, p95: null, succeeded: 0, failed: 0 };
        }

        const p50 = 92 + day * 26 + noise(slot + 100) * 14 + (slow ? 64 : 0);
        const p95 = p50 * (2.6 + noise(slot + 200) * 0.6) + (slow ? 520 : 0);

        return { at, p50: Math.round(p50), p95: Math.round(p95), succeeded: runs - failed, failed };
    });
}

export interface LatencyBucket {
    readonly at: number;
    readonly p95: number;
}

/* The p95 latency every 20 minutes over the same hours, two buckets between every two of the errors. */
export function latency(): LatencyBucket[] {
    return Array.from({ length: 70 }, (_, step) => {
        const at = START + step * 20 * 60_000;
        const hour = step / 3;
        const day = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 0.5 + 0.5;
        const spike = hour >= 14.6 && hour < 16.4 ? 160 : 0;
        return { at, p95: Math.round(120 + day * 90 + noise(step + 7) * 30 + spike) };
    });
}

export interface TokenDay {
    readonly day: number;
    readonly input: number;
    readonly output: number;
}

/* Tokens per day over two weeks, lighter on the weekend. */
export function tokensPerDay(): TokenDay[] {
    return Array.from({ length: 14 }, (_, index) => {
        const day = START - (13 - index) * DAY;
        const weekday = new Date(day).getDay();
        const weekend = weekday === 0 || weekday === 6 ? 0.3 : 1;

        return {
            day,
            input: Math.round((1_400_000 + noise(index) * 900_000) * weekend),
            output: Math.round((260_000 + noise(index + 20) * 180_000) * weekend)
        };
    });
}

/* Events per day over two weeks for a handful of services, for a row of sparklines. */
export function eventsPerService(): { name: string; perDay: number[] }[] {
    return ['api', 'worker', 'scheduler', 'mailer'].map((name, service) => ({
        name,
        perDay: Array.from({ length: 14 }, (_, day) => {
            const quiet = service === 3 && day > 3 && day < 7;

            return quiet ? 0 : Math.round(noise(day + service * 31) * (40 + service * 25) + (day === 11 && service === 0 ? 120 : 0));
        })
    }));
}

export interface ModelScore {
    readonly key: string;
    readonly model: string;
    readonly lab: string;
    readonly effort: string;
    readonly score: number;
}

/* A color of the app's own per lab, as a CSS value. These borrow the chart series of the theme. */
export const LAB_COLORS: Record<string, string> = {
    Northwind: 'var(--chart-1)',
    Lumen: 'var(--chart-2)',
    Orbital: 'var(--chart-3)',
    Fathom: 'var(--chart-5)'
};

const MODELS: { model: string; lab: string; scores: [string, number][] }[] = [
    {
        model: 'Atlas 5',
        lab: 'Northwind',
        scores: [
            ['low', 61],
            ['medium', 66],
            ['high', 71],
            ['max', 73]
        ]
    },
    {
        model: 'Lumen Pro',
        lab: 'Lumen',
        scores: [
            ['low', 58],
            ['medium', 63],
            ['high', 68]
        ]
    },
    {
        model: 'Orbit 3',
        lab: 'Orbital',
        scores: [
            ['medium', 55],
            ['high', 62]
        ]
    },
    {
        model: 'Atlas 5 mini',
        lab: 'Northwind',
        scores: [
            ['low', 47],
            ['medium', 52],
            ['high', 57]
        ]
    },
    {
        model: 'Fathom 2',
        lab: 'Fathom',
        scores: [
            ['low', 41],
            ['high', 50]
        ]
    }
];

/* One row per model and effort, a model's efforts together, the models by their best score. */
export function scoresByModel(): ModelScore[] {
    return MODELS.flatMap(({ model, lab, scores }) => scores.map(([effort, score]) => ({ key: `${model}:${effort}`, model, lab, effort, score })));
}

/* Dollars per task of each model and effort, three orders of magnitude apart. */
const COSTS: Record<string, number[]> = {
    'Atlas 5': [0.12, 0.31, 0.74, 1.9],
    'Lumen Pro': [0.08, 0.2, 0.55],
    'Orbit 3': [0.4, 1.1],
    'Atlas 5 mini': [0.015, 0.04, 0.09],
    'Fathom 2': [0.006, 0.02]
};

/* A color per model, so two models of one lab still read apart on a scatter. */
export const MODEL_COLORS: Record<string, string> = {
    'Atlas 5': 'var(--chart-1)',
    'Lumen Pro': 'var(--chart-2)',
    'Orbit 3': 'var(--chart-3)',
    'Atlas 5 mini': 'var(--chart-4)',
    'Fathom 2': 'var(--chart-5)'
};

export interface ModelCost extends ModelScore {
    readonly cost: number;
}

/* The scores per model and effort with what a task costs at each. */
export function costsByModel(): ModelCost[] {
    return MODELS.flatMap(({ model, lab, scores }) =>
        scores.map(([effort, score], index) => ({ key: `${model}:${effort}`, model, lab, effort, score, cost: COSTS[model]![index]! }))
    );
}

/* Dollars with the precision a price per task needs: `$0.006`, `$0.74`, `$1.90`. */
export function formatCost(dollars: number): string {
    return dollars < 0.1 ? `$${formatRounded(dollars, 3)}` : `$${formatRounded(dollars, 2)}`;
}
