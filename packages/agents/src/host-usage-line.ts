/*
 * One call to an API a host makes itself, a line of the usage log it keeps. Such an API has no CLI and so
 * no transcript, so the host writes this line for each call and the scanner reads the folder like one.
 * The kinds are disjoint, as they are in a record: `input` is what was neither read from nor written to
 * a cache, and `reasoning` is a part of `output`. Each host maps the counts of its own API onto them, since
 * the APIs do not agree: some report a prompt that holds its cached part, some report the input apart from both
 * cache kinds, and only some have a cache write at all.
 */
export interface HostUsageEntry {
    at: number;
    model: string;
    session: string;
    cwd: string;
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
}

export function hostUsageLine(entry: HostUsageEntry): string {
    return `${JSON.stringify(entry)}\n`;
}
