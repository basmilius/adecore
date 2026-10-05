import { describe, expect, test } from 'bun:test';
import type { ColumnInfo } from '../protocol/index.ts';
import { formatOfPath, hasMapping, importableColumns, mapColumn, matchColumns } from './import-mapping.ts';

const column = (name: string, generated = false): ColumnInfo => ({
    name,
    type: 'text',
    kind: 'text',
    nullable: true,
    defaultValue: null,
    autoIncrement: false,
    generated,
    comment: null
});

describe('importableColumns', () => {
    test('leaves out the generated columns', () => {
        expect(importableColumns([column('id'), column('total', true), column('name')]).map((info) => info.name)).toEqual(['id', 'name']);
    });
});

describe('formatOfPath', () => {
    test('reads the extension', () => {
        expect(formatOfPath('/tmp/users.tsv')).toBe('tsv');
        expect(formatOfPath('/tmp/Users.TSV')).toBe('tsv');
        expect(formatOfPath('/tmp/users.csv')).toBe('csv');
        expect(formatOfPath('/tmp/users.txt')).toBe('csv');
        expect(formatOfPath('/tmp/tsv')).toBe('csv');
    });
});

describe('matchColumns', () => {
    const table = ['id', 'Name', 'email'];

    test('matches by name without regard to case', () => {
        expect(matchColumns(['NAME', 'id', 'phone'], table, true)).toEqual(['Name', 'id', null]);
    });

    test('gives a table column to one file column only', () => {
        expect(matchColumns(['name', 'NAME'], table, true)).toEqual(['Name', null]);
    });

    test('ignores spaces around a file name', () => {
        expect(matchColumns([' id '], table, true)).toEqual(['id']);
    });

    test('goes by position when the file has no header', () => {
        expect(matchColumns(['column1', 'column2', 'column3', 'column4'], table, false)).toEqual(['id', 'Name', 'email', null]);
    });
});

describe('mapColumn', () => {
    test('sets one file column and frees the table column from another', () => {
        expect(mapColumn(['id', 'name', null], 2, 'id')).toEqual([null, 'name', 'id']);
    });

    test('skips a file column with null', () => {
        expect(mapColumn(['id', 'name'], 0, null)).toEqual([null, 'name']);
    });
});

describe('hasMapping', () => {
    test('is true once any file column goes somewhere', () => {
        expect(hasMapping([null, null])).toBe(false);
        expect(hasMapping([null, 'id'])).toBe(true);
        expect(hasMapping([])).toBe(false);
    });
});
