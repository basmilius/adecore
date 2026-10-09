import { expect, test } from 'bun:test';
import { z } from 'zod';
import { compileUiBlock } from './compiler.ts';
import { uiQueryArguments, uiQueryFallback } from './query.ts';

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

test('the query fallback reads every node the way the compiled fallback does', () => {
    const block = compileUiBlock(
        '$rows = @Query("rows", {limit: 2, repo: "."})\n<Stats><Stat label="Rows" value={$rows.count}/></Stats><Sources><Source title="Docs" url="https://adecore.dev"/></Sources><File path="src/a.ts">Entry</File>',
        { id: 'b', final: true, querySchemas: schemas }
    );
    expect(block.diagnostics).toEqual([]);
    expect(uiQueryFallback(block, { $rows: { count: 4 } })).toBe('Rows: 4\nDocs: https://adecore.dev\nsrc/a.ts Entry');
});
