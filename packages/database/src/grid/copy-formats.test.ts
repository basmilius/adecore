import { describe, expect, test } from 'bun:test';
import { formatCopy, type CopyInput } from './copy-formats.ts';

const input: CopyInput = {
    columns: [
        { name: 'id', kind: 'integer' },
        { name: 'name', kind: 'text' },
        { name: 'price', kind: 'decimal' },
        { name: 'active', kind: 'boolean' },
        { name: 'data', kind: 'binary' }
    ],
    rows: [
        [1, 'Ada, "the" first', '12.50', true, { kind: 'binary', hex: 'ab01', length: 2 }],
        [2, null, '9007199254740993', false, null],
        [3, 'two\nlines\tand tab', '0', true, null]
    ],
    target: { engine: 'sqlite', table: 'items' }
};

describe('formatCopy tsv', () => {
    test('separates cells with tabs and rows with line feeds, without a header', () => {
        expect(formatCopy('tsv', { columns: input.columns, rows: [input.rows[1]!] })).toBe('2\tNULL\t9007199254740993\tfalse\tNULL');
    });

    test('quotes a cell that holds a tab, a line break or a quote', () => {
        const text = formatCopy('tsv', { columns: input.columns, rows: [input.rows[2]!] });
        expect(text).toBe('3\t"two\nlines\tand tab"\t0\ttrue\tNULL');
        expect(formatCopy('tsv', { columns: [input.columns[1]!], rows: [['say "hi"']] })).toBe('"say ""hi"""');
    });

    test('is empty for no rows', () => {
        expect(formatCopy('tsv', { columns: input.columns, rows: [] })).toBe('');
    });
});

describe('formatCopy csv', () => {
    test('starts with a header, ends rows with CRLF and leaves NULL empty', () => {
        const text = formatCopy('csv', { columns: input.columns, rows: [input.rows[1]!] });
        expect(text).toBe('id,name,price,active,data\r\n2,,9007199254740993,false,');
    });

    test('quotes a field with a comma, a quote or a line break and doubles the quotes', () => {
        const lines = formatCopy('csv', input).split('\r\n');
        expect(lines[1]).toBe('1,"Ada, ""the"" first",12.50,true,0xab01');
        expect(formatCopy('csv', { columns: [{ name: 'a,b', kind: 'text' }], rows: [['x\ny']] })).toBe('"a,b"\r\n"x\ny"');
    });
});

describe('formatCopy json', () => {
    test('is an array of objects with typed values', () => {
        const parsed = JSON.parse(formatCopy('json', input)) as Record<string, unknown>[];
        expect(parsed).toHaveLength(3);
        expect(parsed[0]).toEqual({ id: 1, name: 'Ada, "the" first', price: 12.5, active: true, data: '0xab01' });
        expect(parsed[1]).toEqual({ id: 2, name: null, price: Number('9007199254740993'), active: false, data: null });
    });

    test('keeps a decimal exactly as the server wrote it', () => {
        expect(formatCopy('json', { columns: [{ name: 'price', kind: 'decimal' }], rows: [['9007199254740993.10']] })).toContain(
            '"price": 9007199254740993.10'
        );
    });

    test('keeps a decimal that is not a JSON number as text', () => {
        expect(formatCopy('json', { columns: [{ name: 'price', kind: 'decimal' }], rows: [['01.5']] })).toContain('"price": "01.5"');
    });

    test('reads a 0 or 1 in a boolean column as a boolean', () => {
        expect(JSON.parse(formatCopy('json', { columns: [{ name: 'on', kind: 'boolean' }], rows: [[1], [0]] }))).toEqual([{ on: true }, { on: false }]);
    });

    test('embeds a JSON column and falls back to text when it does not parse', () => {
        const columns = [{ name: 'doc', kind: 'json' as const }];
        expect(JSON.parse(formatCopy('json', { columns, rows: [['{"a":1}'], ['{oops']] }))).toEqual([{ doc: { a: 1 } }, { doc: '{oops' }]);
    });

    test('is [] for no rows', () => {
        expect(formatCopy('json', { columns: input.columns, rows: [] })).toBe('[]');
    });
});

describe('formatCopy sql', () => {
    test('writes one INSERT per row for SQLite', () => {
        const text = formatCopy('sql', input);
        const lines = text.split('\n');
        expect(text.match(/^INSERT INTO/gm)).toHaveLength(3);
        expect(lines[0]).toBe(`INSERT INTO "items" ("id", "name", "price", "active", "data") VALUES (1, 'Ada, "the" first', 12.50, 1, X'ab01');`);
        expect(lines[1]).toBe(`INSERT INTO "items" ("id", "name", "price", "active", "data") VALUES (2, NULL, 9007199254740993, 0, NULL);`);
    });

    test('writes MySQL identifiers, booleans and binary', () => {
        const text = formatCopy('sql', { ...input, rows: [input.rows[0]!], target: { engine: 'mysql', schema: 'shop', table: 'items' } });
        expect(text).toBe('INSERT INTO `shop`.`items` (`id`, `name`, `price`, `active`, `data`) VALUES (1, \'Ada, "the" first\', 12.50, TRUE, 0xab01);');
    });

    test('doubles a single quote', () => {
        expect(formatCopy('sql', { columns: [{ name: 'n', kind: 'text' }], rows: [["it's"]], target: { engine: 'sqlite', table: 'result' } })).toContain(
            "'it''s'"
        );
    });

    test('copies a preview as its preview', () => {
        expect(
            formatCopy('sql', {
                columns: [{ name: 'n', kind: 'text' }],
                rows: [[{ kind: 'longText', preview: 'abc', length: 900 }]],
                target: { engine: 'sqlite', table: 'result' }
            })
        ).toContain("('abc')");
    });

    test('needs a target', () => {
        expect(() => formatCopy('sql', { columns: input.columns, rows: input.rows })).toThrow();
    });
});
