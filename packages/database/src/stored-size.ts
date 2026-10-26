/* A size in pixels a view wrote to the app's storage, or `null` when the text is missing, broken or not at least `minimum`. */
export const parseStoredSize = (raw: string | null | undefined, minimum: number): number | null => {
    try {
        const value: unknown = JSON.parse(raw ?? 'null');

        return typeof value === 'number' && Number.isFinite(value) && value >= minimum ? Math.round(value) : null;
    } catch {
        return null;
    }
};
