/*
 * Work that runs once per key at a time: a caller that asks while it runs shares its outcome, and
 * a key that settled leaves nothing behind.
 */
export class SingleFlight<T> {
    private readonly flights = new Map<string, Promise<T>>();

    get(key: string): Promise<T> | undefined {
        return this.flights.get(key);
    }

    has(key: string): boolean {
        return this.flights.has(key);
    }

    keys(): IterableIterator<string> {
        return this.flights.keys();
    }

    /* Lets the next caller of `key` start a run of its own. The run in flight carries on for the callers that hold it. */
    forget(key: string): void {
        this.flights.delete(key);
    }

    clear(): void {
        this.flights.clear();
    }

    run(key: string, work: () => Promise<T>): Promise<T> {
        const running = this.flights.get(key);

        if (running !== undefined) {
            return running;
        }

        const flight = work().finally(() => {
            if (this.flights.get(key) === flight) {
                this.flights.delete(key);
            }
        });
        this.flights.set(key, flight);

        return flight;
    }
}
