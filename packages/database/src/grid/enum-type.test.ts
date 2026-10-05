import { describe, expect, test } from 'bun:test';
import { joinMembers, membersOf, parseEnumType } from './enum-type.ts';

describe('parseEnumType', () => {
    test('reads the values of an enum', () => {
        expect(parseEnumType("enum('draft','published','archived')")).toEqual({ kind: 'enum', values: ['draft', 'published', 'archived'] });
    });

    test('reads a set, whatever the case of the keyword', () => {
        expect(parseEnumType("SET('a','b')")).toEqual({ kind: 'set', values: ['a', 'b'] });
        expect(parseEnumType("Enum ('x')")).toEqual({ kind: 'enum', values: ['x'] });
    });

    test('reads a doubled quote as one quote', () => {
        expect(parseEnumType("enum('it''s','a''''b','''')")).toEqual({ kind: 'enum', values: ["it's", "a''b", "'"] });
    });

    test('keeps commas, parentheses and spaces inside a value', () => {
        expect(parseEnumType("enum('a,b','c (d)',' e ')")).toEqual({ kind: 'enum', values: ['a,b', 'c (d)', ' e '] });
    });

    test('keeps an empty value', () => {
        expect(parseEnumType("enum('','a')")).toEqual({ kind: 'enum', values: ['', 'a'] });
    });

    test('is null for other types and for lists that do not parse', () => {
        expect(parseEnumType('varchar(255)')).toBeNull();
        expect(parseEnumType('')).toBeNull();
        expect(parseEnumType('enum()')).toBeNull();
        expect(parseEnumType("enum('a','b'")).toBeNull();
        expect(parseEnumType("enum('a' 'b')")).toBeNull();
        expect(parseEnumType("enum('a','b') extra")).toBeNull();
        expect(parseEnumType('enum(a,b)')).toBeNull();
    });
});

describe('set members', () => {
    const type = { kind: 'set' as const, values: ['a', 'b', 'c'] };

    test('splits a value into its members', () => {
        expect(membersOf('a,c')).toEqual(['a', 'c']);
        expect(membersOf('')).toEqual([]);
    });

    test('joins members in the order of the column', () => {
        expect(joinMembers(type, new Set(['c', 'a']))).toBe('a,c');
        expect(joinMembers(type, new Set())).toBe('');
    });
});
