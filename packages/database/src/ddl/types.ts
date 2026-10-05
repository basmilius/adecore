import type { Dialect } from './dialect.ts';

const SQLITE_TYPES = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'] as const;

const MYSQL_TYPES = [
    'tinyint',
    'smallint',
    'mediumint',
    'int',
    'bigint',
    'bigint unsigned',
    'decimal(10,2)',
    'float',
    'double',
    'bit(1)',
    'char(36)',
    'varchar(255)',
    'varchar(64)',
    'tinytext',
    'text',
    'mediumtext',
    'longtext',
    'binary(16)',
    'varbinary(255)',
    'tinyblob',
    'blob',
    'mediumblob',
    'longblob',
    'date',
    'time',
    'datetime',
    'datetime(6)',
    'timestamp',
    'timestamp(6)',
    'year',
    'json',
    "enum('a','b')",
    "set('a','b')"
] as const;

/* The types a type field offers; any other text is still allowed, since both engines accept more than a list holds. */
export const typeSuggestionsOf = (dialect: Dialect): readonly string[] => (dialect.engine === 'sqlite' ? SQLITE_TYPES : MYSQL_TYPES);

export const MYSQL_ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'ARCHIVE', 'CSV'] as const;

export const MYSQL_CHARSETS = ['utf8mb4', 'utf8mb3', 'latin1', 'ascii', 'binary'] as const;

/* Collations to offer for a character set, which is the family it is named after. */
export const collationSuggestionsOf = (charset: string): readonly string[] => {
    if (charset === '') {
        return [];
    }
    if (charset === 'binary') {
        return ['binary'];
    }
    const suggestions = [`${charset}_general_ci`, `${charset}_unicode_ci`, `${charset}_bin`];
    return charset === 'utf8mb4' ? ['utf8mb4_0900_ai_ci', 'utf8mb4_unicode_520_ci', ...suggestions] : suggestions;
};

export const FOREIGN_KEY_ACTIONS = ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'] as const;
