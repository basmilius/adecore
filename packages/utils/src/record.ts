/* Any object but an array, such as one read off the wire or a file whose fields are still unchecked. A Date or a class instance passes too. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
