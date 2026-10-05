import { describe, expect, test } from 'bun:test';
import { orderSchemas } from './schemas.ts';

describe('orderSchemas', () => {
    test('puts the system schemas last and keeps the order within each group', () => {
        const ordered = orderSchemas([
            { name: 'information_schema', system: true },
            { name: 'shop', system: false },
            { name: 'mysql', system: true },
            { name: 'blog', system: false }
        ]);
        expect(ordered.map(({ name }) => name)).toEqual(['shop', 'blog', 'information_schema', 'mysql']);
    });
});
