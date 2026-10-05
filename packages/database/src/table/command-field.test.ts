import { describe, expect, test } from 'bun:test';
import {
    addChip,
    cellChip,
    chipsFromQuery,
    chipsToOrderBy,
    chipsToWhere,
    filterChipsOf,
    filterStartText,
    identifierText,
    matchColumns,
    parseCondition,
    removeChipAt,
    replaceChipAt,
    shorten,
    sortChipsOf,
    sortsOf,
    suggest,
    toggleSort,
    withSorts,
    type Chip,
    type CommandColumn,
    type FilterChip
} from './command-field.ts';

const names = ['id', 'quantity', 'name', 'unit_price_cents', 'created_at', 'deleted_at'];
const columns: CommandColumn[] = names.map((name) => ({ name, type: name === 'name' ? 'TEXT' : 'int' }));

const filter = (text: string, sql = text): FilterChip => ({ kind: 'filter', text, sql });

describe('chipsToWhere', () => {
    test('is empty without a filter and the condition alone with one', () => {
        expect(chipsToWhere([])).toBe('');
        expect(chipsToWhere([{ kind: 'sort', column: 'id', direction: 'asc' }])).toBe('');
        expect(chipsToWhere([filter('a = 1 OR b = 2')])).toBe('a = 1 OR b = 2');
    });

    test('ands the conditions in order and wraps the ones that hold an OR', () => {
        expect(chipsToWhere([filter('"quantity" > 1', '"quantity" > 1'), filter('a = 1 or b = 2'), filter('c = 3')])).toBe(
            '"quantity" > 1 AND (a = 1 or b = 2) AND c = 3'
        );
    });

    test('does not mistake a word that contains or for an OR', () => {
        expect(chipsToWhere([filter('color = 1'), filter('b = 2')])).toBe('color = 1 AND b = 2');
    });

    test('uses the sql of a chip, not its text', () => {
        expect(chipsToWhere([filter('quantity > 1', '"quantity" > 1')])).toBe('"quantity" > 1');
    });
});

describe('chipsToOrderBy', () => {
    test('writes the sort chips in order, quoted per engine', () => {
        const chips: Chip[] = [{ kind: 'sort', column: 'created_at', direction: 'desc' }, filter('a = 1'), { kind: 'sort', column: 'id', direction: 'asc' }];
        expect(chipsToOrderBy('sqlite', chips)).toBe('"created_at" DESC, "id" ASC');
        expect(chipsToOrderBy('mysql', chips)).toBe('`created_at` DESC, `id` ASC');
    });

    test('keeps a raw ORDER BY where it stood', () => {
        expect(
            chipsToOrderBy('sqlite', [
                { kind: 'order', text: 'name NULLS LAST' },
                { kind: 'sort', column: 'id', direction: 'asc' }
            ])
        ).toBe('name NULLS LAST, "id" ASC');
    });

    test('is empty without sorts', () => {
        expect(chipsToOrderBy('sqlite', [filter('a = 1')])).toBe('');
    });
});

describe('editing the chips', () => {
    const chips: Chip[] = [filter('a = 1'), { kind: 'sort', column: 'id', direction: 'asc' }];

    test('toggleSort adds a column as ascending and flips one that is there, in place', () => {
        expect(toggleSort(chips, 'name')).toEqual([...chips, { kind: 'sort', column: 'name', direction: 'asc' }]);
        expect(toggleSort(chips, 'id')).toEqual([filter('a = 1'), { kind: 'sort', column: 'id', direction: 'desc' }]);
        expect(toggleSort(toggleSort(chips, 'id'), 'id')).toEqual(chips);
    });

    test('withSorts replaces every sort and raw ORDER BY and keeps the filters', () => {
        const mixed: Chip[] = [...chips, { kind: 'order', text: 'x NULLS LAST' }];
        expect(withSorts(mixed, [{ column: 'name', direction: 'desc' }])).toEqual([filter('a = 1'), { kind: 'sort', column: 'name', direction: 'desc' }]);
        expect(withSorts(mixed, [])).toEqual([filter('a = 1')]);
    });

    test('sortsOf lists the sort chips only', () => {
        expect(sortsOf(chips)).toEqual([{ column: 'id', direction: 'asc' }]);
    });

    test('addChip skips a chip that is there already', () => {
        expect(addChip(chips, filter('a = 1'))).toEqual(chips);
        expect(addChip(chips, filter('b = 2'))).toHaveLength(3);
    });

    test('removeChipAt and replaceChipAt change one place', () => {
        expect(removeChipAt(chips, 0)).toEqual([chips[1]!]);
        expect(replaceChipAt(chips, 0, filter('c = 3'))).toEqual([filter('c = 3'), chips[1]!]);
        expect(replaceChipAt([filter('a = 1'), filter('b = 2')], 0, filter('b = 2'))).toEqual([filter('b = 2')]);
    });
});

describe('chips from a remembered query', () => {
    test('makes sort chips of an ORDER BY that is a plain list', () => {
        expect(sortChipsOf('sqlite', 'created_at DESC, "name"')).toEqual([
            { kind: 'sort', column: 'created_at', direction: 'desc' },
            { kind: 'sort', column: 'name', direction: 'asc' }
        ]);
    });

    test('keeps any other ORDER BY as one raw chip', () => {
        expect(sortChipsOf('sqlite', 'lower(name)')).toEqual([{ kind: 'order', text: 'lower(name)' }]);
        expect(sortChipsOf('sqlite', '  ')).toEqual([]);
    });

    test('makes one raw filter of a WHERE, or the remembered chips while they still say it', () => {
        expect(filterChipsOf('')).toEqual([]);
        expect(filterChipsOf(' id = 3 ')).toEqual([filter('id = 3')]);
        const remembered = [filter('quantity > 1', '"quantity" > 1'), filter('name LIKE "a"', '"name" LIKE "a"')];
        expect(filterChipsOf('"quantity" > 1 AND "name" LIKE "a"', remembered)).toEqual(remembered);
        expect(filterChipsOf('id = 3', remembered)).toEqual([filter('id = 3')]);
    });

    test('round trips what the chips write', () => {
        const chips: Chip[] = [filter('quantity > 1', '"quantity" > 1'), { kind: 'sort', column: 'created_at', direction: 'desc' }];
        const where = chipsToWhere(chips);
        const orderBy = chipsToOrderBy('sqlite', chips);
        expect(chipsFromQuery('sqlite', { where, orderBy, remembered: [chips[0] as FilterChip] })).toEqual(chips);
        expect(chipsToOrderBy('sqlite', chipsFromQuery('sqlite', { where, orderBy }))).toBe(orderBy);
    });
});

describe('parseCondition', () => {
    const parse = (text: string) => parseCondition('sqlite', text, names);

    test('reads a comparison and quotes the column for the engine', () => {
        expect(parse('quantity > 1')).toEqual(filter('quantity > 1', '"quantity" > 1'));
        expect(parseCondition('mysql', 'quantity>=2', names)).toEqual(filter('quantity >= 2', '`quantity` >= 2'));
        expect(parse('quantity == 3')).toEqual(filter('quantity = 3', '"quantity" = 3'));
        expect(parse('quantity != 3')).toEqual(filter('quantity <> 3', '"quantity" <> 3'));
    });

    test('reads LIKE, IN, BETWEEN and the IS tests', () => {
        expect(parse("name LIKE '%a%'")).toEqual(filter("name LIKE '%a%'", `"name" LIKE '%a%'`));
        expect(parse("name not like 'x'")).toEqual(filter("name NOT LIKE 'x'", `"name" NOT LIKE 'x'`));
        expect(parse('quantity in (1, 2)')).toEqual(filter('quantity IN (1, 2)', '"quantity" IN (1, 2)'));
        expect(parse('quantity between 1 and 5')).toEqual(filter('quantity BETWEEN 1 AND 5', '"quantity" BETWEEN 1 AND 5'));
        expect(parse('deleted_at IS NULL')).toEqual(filter('deleted_at IS NULL', '"deleted_at" IS NULL'));
        expect(parse('deleted_at is  not null')).toEqual(filter('deleted_at IS NOT NULL', '"deleted_at" IS NOT NULL'));
    });

    test('finds the column without regard to case and takes a quoted one', () => {
        expect(parse('Quantity > 1')).toEqual(filter('Quantity > 1', '"quantity" > 1'));
        expect(parse('"quantity" > 1')?.sql).toBe('"quantity" > 1');
    });

    test('is null while the condition is unfinished', () => {
        expect(parse('quantity')).toBeNull();
        expect(parse('quantity ')).toBeNull();
        expect(parse('quantity >')).toBeNull();
        expect(parse('quantity > ')).toBeNull();
        expect(parse("name LIKE '%a")).toBeNull();
        expect(parse('quantity IN (1, 2')).toBeNull();
        expect(parse('quantity BETWEEN 1')).toBeNull();
        expect(parse('deleted_at IS')).toBeNull();
    });

    test('is null for text that does not start with a column', () => {
        expect(parse('nope > 1')).toBeNull();
        expect(parse('lower(name) = 1')).toBeNull();
        expect(parse('')).toBeNull();
    });

    test('lets a string value hold an operator or a parenthesis', () => {
        expect(parse("name = 'a > (b'")?.sql).toBe(`"name" = 'a > (b'`);
    });
});

describe('cellChip', () => {
    test('filters on the value of a cell', () => {
        expect(cellChip('sqlite', 'quantity', '1', 'integer', false)).toEqual(filter('quantity = 1', '"quantity" = 1'));
        expect(cellChip('mysql', 'name', "O'Neil", 'text', false)).toEqual(filter("name = 'O''Neil'", "`name` = 'O''Neil'"));
    });

    test('excludes it with <> and writes NULL as IS NULL and IS NOT NULL', () => {
        expect(cellChip('sqlite', 'quantity', '1', 'integer', true)).toEqual(filter('quantity <> 1', '"quantity" <> 1'));
        expect(cellChip('sqlite', 'notes', null, 'text', false)).toEqual(filter('notes IS NULL', '"notes" IS NULL'));
        expect(cellChip('sqlite', 'notes', null, 'text', true)).toEqual(filter('notes IS NOT NULL', '"notes" IS NOT NULL'));
    });

    test('quotes a column name that is not a bare word in the text, and the text reads back as the same condition', () => {
        const chip = cellChip('sqlite', 'Created At', 'x', 'text', false);
        expect(chip.text).toBe(`"Created At" = 'x'`);
        expect(parseCondition('sqlite', chip.text, ['Created At'])).toEqual(chip);
    });
});

describe('identifierText and shorten', () => {
    test('quotes only a name that is not a bare word', () => {
        expect(identifierText('created_at')).toBe('created_at');
        expect(identifierText('Created At')).toBe('"Created At"');
        expect(identifierText('a"b')).toBe('"a""b"');
    });

    test('cuts a long text with an ellipsis', () => {
        expect(shorten('abc', 5)).toBe('abc');
        expect(shorten('abcdefgh', 5)).toBe('abcd…');
    });

    test('filterStartText leaves room for the operator', () => {
        expect(filterStartText({ name: 'quantity', type: 'int' })).toBe('quantity ');
        expect(filterStartText({ name: 'Created At', type: 'int' })).toBe('"Created At" ');
    });
});

describe('matchColumns', () => {
    test('puts the name itself first, then the start, then a word of it, then any part', () => {
        const list: CommandColumn[] = ['order_unit', 'unit', 'unit_price', 'community'].map((name) => ({ name, type: '' }));
        expect(matchColumns(list, 'unit').map((column) => column.name)).toEqual(['unit', 'unit_price', 'order_unit', 'community']);
    });

    test('ignores case and a quote the person opened', () => {
        expect(matchColumns(columns, 'QUAN').map((column) => column.name)).toEqual(['quantity']);
        expect(matchColumns(columns, '"quan').map((column) => column.name)).toEqual(['quantity']);
    });

    test('finds nothing for empty text or no match, and stops at the limit', () => {
        expect(matchColumns(columns, '  ')).toEqual([]);
        expect(matchColumns(columns, 'zzz')).toEqual([]);
        expect(matchColumns(columns, '_', 2)).toHaveLength(2);
    });
});

describe('suggest', () => {
    const kinds = (text: string) =>
        suggest('sqlite', text, columns).map((entry) =>
            entry.kind === 'filter' || entry.kind === 'sort' || entry.kind === 'jump' ? `${entry.kind}:${entry.column.name}` : entry.kind
        );

    test('offers nothing for empty text', () => {
        expect(suggest('sqlite', '', columns)).toEqual([]);
        expect(suggest('sqlite', '   ', columns)).toEqual([]);
    });

    test('offers filter, sort and jump for a matching column, and the text as SQL last', () => {
        expect(kinds('unit_')).toEqual(['filter:unit_price_cents', 'sort:unit_price_cents', 'jump:unit_price_cents', 'sql']);
    });

    test('offers only SQL for text that matches no column', () => {
        expect(kinds('zzz')).toEqual(['sql']);
    });

    test('lists every matching column in turn', () => {
        expect(kinds('_at')).toEqual([
            'filter:created_at',
            'sort:created_at',
            'jump:created_at',
            'filter:deleted_at',
            'sort:deleted_at',
            'jump:deleted_at',
            'sql'
        ]);
    });

    test('stops offering columns once an operator is being typed', () => {
        expect(kinds('quantity ')).toEqual(['sql']);
        expect(kinds('quantity >')).toEqual(['sql']);
    });

    test('puts a text that already reads as a condition first', () => {
        const [first, ...rest] = suggest('sqlite', 'quantity > 1', columns);
        expect(first).toEqual({ kind: 'condition', chip: filter('quantity > 1', '"quantity" > 1') });
        expect(rest).toEqual([{ kind: 'sql', chip: filter('quantity > 1') }]);
    });

    test('hands the typed text to the SQL entry as it was typed', () => {
        const last = suggest('sqlite', ' lower(name) = 1 ', columns).at(-1);
        expect(last).toEqual({ kind: 'sql', chip: filter('lower(name) = 1') });
    });
});
