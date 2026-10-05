import { describe, expect, test } from 'bun:test';
import { expansionKey, parseExpansion, serializeExpansion, type Expansion } from './expansion.ts';
import { connectionKey, folderKey, schemaKey, tableKey } from './tree.ts';

describe('expansion', () => {
    const expanded = new Set([
        connectionKey('one'),
        schemaKey('one', 'main'),
        tableKey({ connectionId: 'one', schema: 'main', table: 'orders' }),
        connectionKey('two')
    ]);
    const collapsed = new Set([folderKey('one', 'main', 'view'), folderKey('two', 'main', 'view')]);

    test('keys the state by connection', () => {
        expect(expansionKey('one')).toBe('database:explorer:one');
    });

    test('stores only the keys of one connection and reads them back', () => {
        const raw = serializeExpansion('one', { expanded, collapsed });
        expect(JSON.parse(raw!).version).toBe(1);
        const read = parseExpansion(raw, 'one');
        expect([...read.expanded].sort()).toEqual([...expanded].filter((key) => !key.includes('two')).sort());
        expect([...read.collapsed]).toEqual([folderKey('one', 'main', 'view')]);
    });

    test('is nothing to store when nothing is open', () => {
        expect(serializeExpansion('one', { expanded: new Set<string>(), collapsed: new Set<string>() })).toBeNull();
        expect(serializeExpansion('three', { expanded, collapsed })).toBeNull();
    });

    test('ignores what is broken, from another version or about another connection', () => {
        const empty: Expansion = { expanded: new Set<string>(), collapsed: new Set<string>() };
        expect(parseExpansion(null, 'one')).toEqual(empty);
        expect(parseExpansion('{', 'one')).toEqual(empty);
        expect(parseExpansion('null', 'one')).toEqual(empty);
        expect(parseExpansion('{"version":2,"expanded":["c:one"]}', 'one')).toEqual(empty);
        expect(parseExpansion('{"version":1,"expanded":"c:one","collapsed":[1]}', 'one')).toEqual(empty);
        const mixed = JSON.stringify({ version: 1, expanded: ['c:one', 'c:two', 7, folderKey('one', 'main', 'view')], collapsed: [connectionKey('one')] });
        expect(parseExpansion(mixed, 'one')).toEqual({ expanded: new Set(['c:one']), collapsed: new Set() });
    });
});
