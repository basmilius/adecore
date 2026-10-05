import { describe, expect, test } from 'bun:test';
import { andWhere, equalsCondition, matchCondition, orderByClause, parseOrderBy, qualifiedName, quoteIdentifier, sqlLiteral } from './sql.ts';

describe('quoteIdentifier', () => {
    test('quotes with double quotes for SQLite and backticks for MySQL', () => {
        expect(quoteIdentifier('sqlite', 'created_at')).toBe('"created_at"');
        expect(quoteIdentifier('mysql', 'created_at')).toBe('`created_at`');
    });

    test('doubles the quote mark inside a name', () => {
        expect(quoteIdentifier('sqlite', 'we"ird')).toBe('"we""ird"');
        expect(quoteIdentifier('mysql', 'we`ird')).toBe('`we``ird`');
        expect(quoteIdentifier('mysql', 'we"ird')).toBe('`we"ird`');
    });
});

describe('qualifiedName', () => {
    test('quotes the schema and the table', () => {
        expect(qualifiedName({ engine: 'mysql', schema: 'shop', table: 'orders' })).toBe('`shop`.`orders`');
        expect(qualifiedName({ engine: 'sqlite', table: 'result' })).toBe('"result"');
    });
});

describe('sqlLiteral', () => {
    test('writes NULL, numbers and booleans', () => {
        expect(sqlLiteral('sqlite', null)).toBe('NULL');
        expect(sqlLiteral('sqlite', 12.5)).toBe('12.5');
        expect(sqlLiteral('sqlite', Number.NaN)).toBe('NULL');
        expect(sqlLiteral('sqlite', true)).toBe('1');
        expect(sqlLiteral('sqlite', false)).toBe('0');
        expect(sqlLiteral('mysql', true)).toBe('TRUE');
        expect(sqlLiteral('mysql', false)).toBe('FALSE');
    });

    test('doubles the single quotes of a string', () => {
        expect(sqlLiteral('sqlite', "it's")).toBe("'it''s'");
        expect(sqlLiteral('mysql', "it's")).toBe("'it''s'");
    });

    test('doubles a backslash for MySQL only', () => {
        expect(sqlLiteral('mysql', 'a\\b')).toBe("'a\\\\b'");
        expect(sqlLiteral('sqlite', 'a\\b')).toBe("'a\\b'");
    });

    test('keeps a number that arrived as text raw when the column is numeric', () => {
        expect(sqlLiteral('mysql', '12.50', 'decimal')).toBe('12.50');
        expect(sqlLiteral('mysql', '9007199254740993', 'integer')).toBe('9007199254740993');
        expect(sqlLiteral('mysql', '12abc', 'decimal')).toBe("'12abc'");
        expect(sqlLiteral('mysql', '12', 'text')).toBe("'12'");
        expect(sqlLiteral('mysql', '2024-01-01', 'date')).toBe("'2024-01-01'");
    });

    test('writes binary as X quotes for SQLite and 0x for MySQL', () => {
        expect(sqlLiteral('sqlite', { kind: 'binary', hex: 'ab01', length: 2 })).toBe("X'ab01'");
        expect(sqlLiteral('mysql', { kind: 'binary', hex: 'ab01', length: 2 })).toBe('0xab01');
        expect(sqlLiteral('mysql', { kind: 'binary', hex: '', length: 0 })).toBe("X''");
    });

    test('writes a long text preview as its text and a default as DEFAULT', () => {
        expect(sqlLiteral('sqlite', { kind: 'longText', preview: 'abc', length: 900 })).toBe("'abc'");
        expect(sqlLiteral('sqlite', { kind: 'default' })).toBe('DEFAULT');
    });
});

describe('equalsCondition', () => {
    test('compares with = and a literal', () => {
        expect(equalsCondition('sqlite', 'name', "O'Neil", 'text')).toBe(`"name" = 'O''Neil'`);
        expect(equalsCondition('mysql', 'id', 7, 'integer')).toBe('`id` = 7');
    });

    test('uses IS NULL for NULL', () => {
        expect(equalsCondition('mysql', 'notes', null, 'text')).toBe('`notes` IS NULL');
    });
});

describe('orderByClause', () => {
    test('quotes every column and spells the direction', () => {
        expect(
            orderByClause('mysql', [
                { column: 'country', direction: 'asc' },
                { column: 'created_at', direction: 'desc' }
            ])
        ).toBe('`country` ASC, `created_at` DESC');
        expect(orderByClause('sqlite', [])).toBe('');
    });
});

describe('parseOrderBy', () => {
    const columns = ['id', 'name', 'created_at'];

    test('reads empty text as no sorts', () => {
        expect(parseOrderBy('sqlite', '  ', columns)).toEqual([]);
    });

    test('reads bare and quoted columns with and without a direction', () => {
        expect(parseOrderBy('sqlite', 'created_at DESC, "name"', columns)).toEqual([
            { column: 'created_at', direction: 'desc' },
            { column: 'name', direction: 'asc' }
        ]);
        expect(parseOrderBy('mysql', '`id` desc', columns)).toEqual([{ column: 'id', direction: 'desc' }]);
    });

    test('finds a column without regard to case', () => {
        expect(parseOrderBy('sqlite', 'NAME asc', columns)).toEqual([{ column: 'name', direction: 'asc' }]);
    });

    test('undoes the doubled quote mark of a quoted name', () => {
        expect(parseOrderBy('sqlite', '"we""ird"', ['we"ird'])).toEqual([{ column: 'we"ird', direction: 'asc' }]);
    });

    test('is null for anything that is not a plain list of known columns', () => {
        expect(parseOrderBy('sqlite', 'unknown', columns)).toBeNull();
        expect(parseOrderBy('sqlite', 'lower(name)', columns)).toBeNull();
        expect(parseOrderBy('sqlite', 'name DESC NULLS LAST', columns)).toBeNull();
        expect(parseOrderBy('sqlite', 'name,', columns)).toBeNull();
        expect(parseOrderBy('sqlite', ',name', columns)).toBeNull();
        expect(parseOrderBy('sqlite', 'name, name DESC', columns)).toBeNull();
        expect(parseOrderBy('sqlite', '1', columns)).toBeNull();
    });

    test('does not take a double quoted word for a column in MySQL', () => {
        expect(parseOrderBy('mysql', '"name"', columns)).toBeNull();
    });

    test('reads what orderByClause writes', () => {
        const sorts = [
            { column: 'name', direction: 'desc' as const },
            { column: 'id', direction: 'asc' as const }
        ];
        for (const engine of ['sqlite', 'mysql'] as const) {
            expect(parseOrderBy(engine, orderByClause(engine, sorts), columns)).toEqual(sorts);
        }
    });
});

describe('andWhere', () => {
    test('is the condition when the field is empty', () => {
        expect(andWhere('', 'id = 1')).toBe('id = 1');
        expect(andWhere('   ', 'id = 1')).toBe('id = 1');
    });

    test('joins with AND', () => {
        expect(andWhere('country = "NL"', 'id = 1')).toBe('country = "NL" AND id = 1');
    });

    test('wraps what holds an OR', () => {
        expect(andWhere('a = 1 or b = 2', 'c = 3')).toBe('(a = 1 or b = 2) AND c = 3');
    });

    test('does not mistake a word that contains or for an OR', () => {
        expect(andWhere('color = 1', 'c = 3')).toBe('color = 1 AND c = 3');
    });
});

describe('matchCondition', () => {
    test('ands the columns of a key, each quoted for the engine', () => {
        expect(
            matchCondition('mysql', [
                { column: 'order_id', value: '7', kind: 'integer' },
                { column: 'sku', value: "A'1" }
            ])
        ).toBe("`order_id` = 7 AND `sku` = 'A''1'");
    });

    test('writes a single column without an AND', () => {
        expect(matchCondition('sqlite', [{ column: 'id', value: 3 }])).toBe('"id" = 3');
    });

    test('is empty for no columns', () => {
        expect(matchCondition('sqlite', [])).toBe('');
    });
});
