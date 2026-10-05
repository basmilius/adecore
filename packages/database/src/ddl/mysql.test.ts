import { describe, expect, test } from 'bun:test';
import type { ColumnInfo, TableStructure } from '../protocol/index.ts';
import { alterTableSql, createTableSql, dialectOf, draftOf, emptyColumn, emptyDraft, type ColumnDraft, type TableDraft } from './index.ts';

const mysql = dialectOf({ flavor: 'mysql', version: '8.0.36' });

const column = (name: string, type: string, extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
    name,
    type,
    kind: 'text',
    nullable: true,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null,
    ...extra
});

const DDL = [
    'CREATE TABLE `orders` (',
    '  `id` bigint NOT NULL AUTO_INCREMENT,',
    '  `user_id` bigint DEFAULT NULL,',
    "  `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'It''s a status',",
    '  `total` int DEFAULT NULL,',
    '  `double` int GENERATED ALWAYS AS ((`total` * 2)) VIRTUAL,',
    '  PRIMARY KEY (`id`),',
    '  KEY `idx_status` (`status`),',
    '  CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE',
    ") ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Orders (all)'"
].join('\n');

const structure: TableStructure = {
    schema: 'shop',
    name: 'orders',
    kind: 'table',
    columns: [
        column('id', 'bigint', { nullable: false, autoIncrement: true }),
        column('user_id', 'bigint'),
        column('status', 'varchar(20)', { nullable: false, defaultValue: "'draft'", comment: "It's a status" }),
        column('total', 'int'),
        column('double', 'int', { generated: true })
    ],
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [
        { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
        { name: 'idx_status', columns: ['status'], unique: false, primary: false }
    ],
    foreignKeys: [
        {
            name: 'fk_user',
            columns: ['user_id'],
            referencedSchema: 'shop',
            referencedTable: 'users',
            referencedColumns: ['id'],
            onUpdate: null,
            onDelete: 'CASCADE'
        }
    ],
    ddl: DDL
};

const base = draftOf(structure);
const alter = (draft: TableDraft): string => alterTableSql(mysql, 'shop', structure, draft).join('\n;\n');
const withColumns = (columns: readonly ColumnDraft[], rest: Partial<TableDraft> = {}): TableDraft => ({ ...base, columns, ...rest });
const named = (name: string): ColumnDraft => base.columns.find((candidate) => candidate.name === name)!;
const added = (name: string, type: string, rest: Partial<ColumnDraft> = {}): ColumnDraft => ({ ...emptyColumn(name), type, ...rest });

describe('createTableSql for MySQL', () => {
    test('writes columns, keys, an index, a foreign key and the options of a table', () => {
        expect(createTableSql(mysql, 'shop', base)).toEqual([
            [
                'CREATE TABLE `shop`.`orders` (',
                '    `id` bigint NOT NULL AUTO_INCREMENT,',
                '    `user_id` bigint NULL,',
                "    `status` varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'It''s a status',",
                '    `total` int NULL,',
                '    `double` int GENERATED ALWAYS AS ((`total` * 2)) VIRTUAL NULL,',
                '    PRIMARY KEY (`id`),',
                '    INDEX `idx_status` (`status`),',
                '    CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE',
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Orders (all)'"
            ].join('\n')
        ]);
    });

    test('quotes odd names and doubles a backtick', () => {
        const draft: TableDraft = {
            ...emptyDraft(),
            name: 'we`ird table',
            columns: [added('na`me', 'int', { nullable: false })],
            indexes: [{ key: 'one', originalName: null, name: '', columns: ['na`me'], unique: true }]
        };
        expect(createTableSql(mysql, 'my db', draft)[0]).toBe(
            ['CREATE TABLE `my db`.`we``ird table` (', '    `na``me` int NOT NULL,', '    UNIQUE INDEX (`na``me`)', ')'].join('\n')
        );
    });

    test('wraps a default that is an expression in parentheses and leaves literals alone', () => {
        const draft: TableDraft = {
            ...emptyDraft(),
            name: 't',
            columns: [
                added('a', 'char(36)', { defaultValue: 'uuid()' }),
                added('b', 'timestamp', { defaultValue: 'CURRENT_TIMESTAMP(3)' }),
                added('c', 'int', { defaultValue: '-1' }),
                added('d', 'int', { defaultValue: '(1 + 1)' })
            ]
        };
        expect(createTableSql(mysql, 'db', draft)[0]).toContain(
            [
                '`a` char(36) NULL DEFAULT (uuid())',
                '`b` timestamp NULL DEFAULT CURRENT_TIMESTAMP(3)',
                '`c` int NULL DEFAULT -1',
                '`d` int NULL DEFAULT (1 + 1)'
            ].join(',\n    ')
        );
    });

    test('puts no NULL or NOT NULL after the expression of a computed column on MariaDB, which refuses both', () => {
        const mariadb = dialectOf({ flavor: 'mariadb', version: '11.8.9-MariaDB' });
        const [table] = createTableSql(mariadb, 'shop', base);
        expect(table).toContain('`double` int GENERATED ALWAYS AS ((`total` * 2)) VIRTUAL,');
        expect(table).toContain('`total` int NULL,');
    });

    test('escapes a backslash in a comment the way MySQL reads it', () => {
        const draft = { ...emptyDraft(), name: 't', columns: [added('a', 'int', { comment: 'a\\b' })] };
        expect(createTableSql(mysql, 'db', draft)[0]).toContain("COMMENT 'a\\\\b'");
    });
});

describe('alterTableSql for MySQL', () => {
    test('says nothing for a draft that changes nothing', () => {
        expect(alterTableSql(mysql, 'shop', structure, base)).toEqual([]);
    });

    test('adds a column at the end without a position', () => {
        expect(alter(withColumns([...base.columns, added('note', 'text')]))).toBe('ALTER TABLE `shop`.`orders`\n    ADD COLUMN `note` text NULL');
    });

    test('adds a column in the middle after the one before it, and at the start with FIRST', () => {
        const [id, userId, ...rest] = base.columns;
        expect(alter(withColumns([id!, added('note', 'text'), userId!, ...rest]))).toBe(
            'ALTER TABLE `shop`.`orders`\n    ADD COLUMN `note` text NULL AFTER `id`'
        );
        expect(alter(withColumns([added('note', 'text'), ...base.columns]))).toBe('ALTER TABLE `shop`.`orders`\n    ADD COLUMN `note` text NULL FIRST');
    });

    test('drops a column along with an index that no longer has it', () => {
        const draft: TableDraft = withColumns(
            base.columns.filter((candidate) => candidate.name !== 'status'),
            { indexes: [] }
        );
        expect(alter(draft)).toBe('ALTER TABLE `shop`.`orders`\n    DROP INDEX `idx_status`,\n    DROP COLUMN `status`');
    });

    test('modifies a column whose definition changed', () => {
        const total = { ...named('total'), type: 'bigint', nullable: false, defaultValue: '0' };
        expect(alter(withColumns(base.columns.map((candidate) => (candidate.name === 'total' ? total : candidate))))).toBe(
            'ALTER TABLE `shop`.`orders`\n    MODIFY COLUMN `total` bigint NOT NULL DEFAULT 0'
        );
    });

    test('renames a column with CHANGE and follows it in the key and the index', () => {
        const draft: TableDraft = {
            ...withColumns(base.columns.map((candidate) => (candidate.name === 'status' ? { ...candidate, name: 'state' } : candidate))),
            indexes: [{ ...base.indexes[0]!, columns: ['state'] }]
        };
        expect(alter(draft)).toBe(
            "ALTER TABLE `shop`.`orders`\n    CHANGE COLUMN `status` `state` varchar(20) NOT NULL DEFAULT 'draft' COMMENT 'It''s a status'"
        );
    });

    test('moves the fewest columns when the order changes', () => {
        const [id, userId, status, total, double] = base.columns;
        expect(alter(withColumns([userId!, status!, total!, double!, id!]))).toBe(
            'ALTER TABLE `shop`.`orders`\n    MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT AFTER `double`'
        );
        expect(alter(withColumns([double!, id!, userId!, status!, total!]))).toBe(
            'ALTER TABLE `shop`.`orders`\n    MODIFY COLUMN `double` int GENERATED ALWAYS AS ((`total` * 2)) VIRTUAL NULL FIRST'
        );
    });

    test('renames in a statement of its own when a position names the new name', () => {
        const [id, userId, status, total, double] = base.columns;
        const draft = withColumns([{ ...id!, name: 'order_id' }, { ...total! }, userId!, status!, double!], { primaryKey: ['order_id'] });
        expect(alterTableSql(mysql, 'shop', structure, draft)).toEqual([
            'ALTER TABLE `shop`.`orders`\n    CHANGE COLUMN `id` `order_id` bigint NOT NULL AUTO_INCREMENT',
            'ALTER TABLE `shop`.`orders`\n    MODIFY COLUMN `total` int NULL AFTER `order_id`'
        ]);
    });

    test('adds, renames and drops an index', () => {
        const added1 = { key: 'n', originalName: null, name: 'idx_total', columns: ['total', 'user_id'], unique: true };
        expect(alter({ ...base, indexes: [...base.indexes, added1] })).toBe(
            'ALTER TABLE `shop`.`orders`\n    ADD UNIQUE INDEX `idx_total` (`total`, `user_id`)'
        );
        expect(alter({ ...base, indexes: [{ ...base.indexes[0]!, name: 'idx_state' }] })).toBe(
            'ALTER TABLE `shop`.`orders`\n    RENAME INDEX `idx_status` TO `idx_state`'
        );
        expect(alter({ ...base, indexes: [] })).toBe('ALTER TABLE `shop`.`orders`\n    DROP INDEX `idx_status`');
    });

    test('drops and adds an index whose columns changed', () => {
        expect(alter({ ...base, indexes: [{ ...base.indexes[0]!, columns: ['status', 'total'] }] })).toBe(
            'ALTER TABLE `shop`.`orders`\n    DROP INDEX `idx_status`,\n    ADD INDEX `idx_status` (`status`, `total`)'
        );
    });

    test('changes the primary key by dropping it and adding the new one', () => {
        expect(alter({ ...base, primaryKey: ['id', 'user_id'] })).toBe(
            'ALTER TABLE `shop`.`orders`\n    DROP PRIMARY KEY,\n    ADD PRIMARY KEY (`id`, `user_id`)'
        );
        expect(alter({ ...base, primaryKey: [] })).toBe('ALTER TABLE `shop`.`orders`\n    DROP PRIMARY KEY');
    });

    test('adds a foreign key, and drops one', () => {
        const key = {
            key: 'n',
            originalName: null,
            name: 'fk_total',
            columns: ['total'],
            referencedSchema: 'other',
            referencedTable: 'totals',
            referencedColumns: ['id'],
            onUpdate: 'CASCADE',
            onDelete: null
        };
        expect(alter({ ...base, foreignKeys: [...base.foreignKeys, key] })).toBe(
            'ALTER TABLE `shop`.`orders`\n    ADD CONSTRAINT `fk_total` FOREIGN KEY (`total`) REFERENCES `other`.`totals` (`id`) ON UPDATE CASCADE'
        );
        expect(alter({ ...base, foreignKeys: [] })).toBe('ALTER TABLE `shop`.`orders`\n    DROP FOREIGN KEY `fk_user`');
    });

    test('drops and adds a foreign key that changed in two statements, since the name is the same', () => {
        expect(alterTableSql(mysql, 'shop', structure, { ...base, foreignKeys: [{ ...base.foreignKeys[0]!, onDelete: 'SET NULL' }] })).toEqual([
            'ALTER TABLE `shop`.`orders`\n    DROP FOREIGN KEY `fk_user`',
            'ALTER TABLE `shop`.`orders`\n    ADD CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL'
        ]);
    });

    test('changes only the options that differ, and renames the table last', () => {
        expect(alter({ ...base, name: 'sales', options: { ...base.options, engine: 'MyISAM', comment: "Bob's" } })).toBe(
            "ALTER TABLE `shop`.`orders`\n    ENGINE=MyISAM COMMENT='Bob''s',\n    RENAME TO `sales`"
        );
    });

    test('empties the comment of a table, which no other option can be asked to do', () => {
        expect(alter({ ...base, options: { ...base.options, comment: '' } })).toBe("ALTER TABLE `shop`.`orders`\n    COMMENT=''");
        expect(alter({ ...base, options: { ...base.options, engine: '' } })).toBe('');
    });
});
