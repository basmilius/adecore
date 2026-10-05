import type { SchemaInfo } from '../protocol/index.ts';

/* The schemas a person works in first, the ones the server keeps for itself last. */
export const orderSchemas = (schemas: readonly SchemaInfo[]): SchemaInfo[] => [
    ...schemas.filter((schema) => !schema.system),
    ...schemas.filter((schema) => schema.system)
];
