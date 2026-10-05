export interface EnumType {
    readonly kind: 'enum' | 'set';
    readonly values: readonly string[];
}

const DECLARATION = /^(enum|set)\s*\(/i;

/*
 * The values of a MySQL `enum('a','b')` or `set('a','b')` column type, or `null` for any other type
 * or a list that does not parse. A quote inside a value is written doubled (`'it''s'`).
 */
export const parseEnumType = (type: string): EnumType | null => {
    const head = DECLARATION.exec(type.trim());
    if (head === null) {
        return null;
    }
    const source = type.trim().slice(head[0].length);
    const values: string[] = [];
    let position = 0;
    while (position < source.length) {
        if (source[position] !== "'") {
            return null;
        }
        position++;
        let value = '';
        for (;;) {
            if (position >= source.length) {
                return null;
            }
            if (source[position] === "'") {
                if (source[position + 1] === "'") {
                    value += "'";
                    position += 2;
                    continue;
                }
                position++;
                break;
            }
            value += source[position];
            position++;
        }
        values.push(value);
        const next = source[position];
        if (next === ')') {
            return source.slice(position + 1).trim() === '' ? tidy(head[1]!, values) : null;
        }
        if (next !== ',') {
            return null;
        }
        position++;
    }
    return null;
};

const tidy = (kind: string, values: string[]): EnumType | null =>
    values.length === 0 ? null : { kind: kind.toLowerCase() === 'set' ? 'set' : 'enum', values };

/* The members a SET value holds: the text split on commas, empty for the empty set. */
export const membersOf = (value: string): string[] => (value === '' ? [] : value.split(','));

/* A SET value in the order of the column's values, which is the order the server writes it in. */
export const joinMembers = (type: EnumType, members: ReadonlySet<string>): string => type.values.filter((value) => members.has(value)).join(',');
