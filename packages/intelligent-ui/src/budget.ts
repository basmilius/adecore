export interface UiLimits {
    characters: number;
    depth: number;
    nodes: number;
    diagnostics: number;
    steps: number;
    iterations: number;
    stringLength: number;
    milliseconds: number;
}

export const UI_LIMITS: Readonly<UiLimits> = {
    characters: 65536,
    depth: 32,
    nodes: 512,
    diagnostics: 20,
    steps: 20000,
    iterations: 2000,
    stringLength: 16384,
    milliseconds: 30
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
        for (const value of Object.values(this.limits)) {
            if (!Number.isSafeInteger(value) || value <= 0) {
                throw new UiFailure('invalid_limits', 'Budgets must be positive safe integers.');
            }
        }
        this.started = now();
    }

    step(count = 1): void {
        this.steps += count;
        if (this.steps > this.limits.steps || this.now() - this.started > this.limits.milliseconds) {
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
