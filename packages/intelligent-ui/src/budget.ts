export interface UiLimits {
    characters: number;
    depth: number;
    nodes: number;
    diagnostics: number;
    steps: number;
    iterations: number;
    stringLength: number;
    /* Zero leaves admission to deterministic work limits; a positive value also bounds elapsed time. */
    milliseconds: number;
}

const BLOCK_CHARACTERS = 65536;

export const UI_LIMITS: Readonly<UiLimits> = {
    characters: BLOCK_CHARACTERS,
    depth: 32,
    nodes: 512,
    diagnostics: 20,
    // Parsing and validating a string literal can account for each character four times.
    steps: 4 * BLOCK_CHARACTERS,
    iterations: 2000,
    stringLength: 16384,
    milliseconds: 0
};

export class UiFailure extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = 'UiFailure';
    }
}

export class UiBudget {
    readonly limits: Readonly<UiLimits>;
    private steps = 0;
    private iterations = 0;
    private nodes = 0;
    private readonly started: number;
    private readonly now: () => number;

    constructor(limits: Partial<UiLimits> = {}, now: () => number = Date.now) {
        this.now = now;
        this.limits = { ...UI_LIMITS, ...limits };

        for (const [name, value] of Object.entries(this.limits)) {
            if (!Number.isSafeInteger(value) || value < 0 || (value === 0 && name !== 'milliseconds')) {
                throw new UiFailure('invalid_limits', 'Budgets must be positive safe integers, except milliseconds may be zero.');
            }
        }

        this.started = this.limits.milliseconds > 0 ? now() : 0;
    }

    step(count = 1): void {
        this.steps += count;

        if (this.steps > this.limits.steps || (this.limits.milliseconds > 0 && this.now() - this.started > this.limits.milliseconds)) {
            throw new UiFailure('budget_exceeded', 'The operation exceeded its work budget.');
        }
    }

    iteration(count = 1): void {
        this.iterations += count;
        this.step(count);

        if (this.iterations > this.limits.iterations) {
            throw new UiFailure('budget_exceeded', 'The operation exceeded its iteration budget.');
        }
    }

    node(): void {
        this.nodes += 1;
        this.step();

        if (this.nodes > this.limits.nodes) {
            throw new UiFailure('budget_exceeded', 'The operation exceeded its node budget.');
        }
    }

    depth(depth: number): void {
        this.step();

        if (depth > this.limits.depth) {
            throw new UiFailure('budget_exceeded', 'The operation exceeded its nesting budget.');
        }
    }

    string(value: string): string {
        this.step(value.length);

        if (value.length > this.limits.stringLength) {
            throw new UiFailure('budget_exceeded', 'The operation exceeded its string budget.');
        }

        return value;
    }
}

export function safeKey(key: string): string {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new UiFailure('refused_access', `Access to ${key} is refused.`);
    }

    return key;
}
