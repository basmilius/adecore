/* The positioner props a popup part takes beside its own, so a caller places a popup on the one element it renders. */
const PLACEMENT_KEYS = [
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionPadding',
    'collisionBoundary',
    'collisionAvoidance',
    'anchor',
    'sticky',
    'positionMethod'
] as const;

export type PlacementKey = (typeof PLACEMENT_KEYS)[number];

/* Splits a popup part's props into what goes to the positioner and what goes to the popup. */
export function splitPlacement<Props extends Partial<Record<PlacementKey, unknown>>>(props: Props): [Pick<Props, PlacementKey>, Omit<Props, PlacementKey>] {
    const placement: Record<string, unknown> = {};
    const rest: Record<string, unknown> = { ...props };
    for (const key of PLACEMENT_KEYS) {
        placement[key] = props[key];
        delete rest[key];
    }
    return [placement as Pick<Props, PlacementKey>, rest as Omit<Props, PlacementKey>];
}
