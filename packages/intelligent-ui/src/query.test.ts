import { expect, test } from 'bun:test';
import { z } from 'zod';
import { compileUiBlock } from './compiler.ts';
import { uiQueryArguments } from './query.ts';

const schemas = { rows: z.object({ limit: z.number().int().min(1).max(10), repo: z.string() }).strict() };

test('query arguments use only declared validated local inputs', () => {
    const block = compileUiBlock('$rows = @Query("rows", {limit: $limit, repo: "."})\n$limit = 3\n<Slider min={1} max={10} value={$limit}>Rows</Slider>', {
        id: 'b',
        final: true,
        querySchemas: schemas
    });
    expect(block.diagnostics).toEqual([]);
    expect(uiQueryArguments(block, '$rows', { $limit: 5 })).toEqual({ limit: 5, repo: '.' });
    expect(() => uiQueryArguments(block, '$rows', { $limit: 50 })).toThrow('allowed values');
    expect(() => uiQueryArguments(block, '$rows', { repo: '/outside' })).toThrow('bindings');
});

test('a query cannot change its source or depend on another query result', () => {
    const block = compileUiBlock('$source = "rows"\n$a = @Query($source, {limit: 1, repo: "."})\n$b = @Query("rows", {limit: $a.count, repo: "."})', {
        id: 'b',
        final: true,
        querySchemas: schemas
    });
    expect(block.queries).toEqual({});
    expect(block.diagnostics.map((entry) => entry.code)).toEqual(['invalid_query', 'invalid_query']);
});
