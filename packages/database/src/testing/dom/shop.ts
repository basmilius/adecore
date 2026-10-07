import type { ColumnInfo } from '../../protocol/index.ts';
import type { FakeDatabase } from '../fake.ts';

const column = (name: string, type: string, extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
    name,
    type,
    kind: type === 'INTEGER' ? 'integer' : 'text',
    nullable: false,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null,
    ...extra
});

/* Two small tables in `main`, the connection path `/shop.sqlite` of the fake transport. */
export const shopDatabase: FakeDatabase = {
    schemas: {
        main: {
            customers: {
                columns: [column('id', 'INTEGER', { autoIncrement: true }), column('name', 'TEXT')],
                primaryKey: ['id'],
                indexes: [{ name: 'PRIMARY', columns: ['id'], unique: true, primary: true }],
                ddl: 'CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
                rows: [
                    [1, 'Ada'],
                    [2, 'Linus']
                ]
            },
            orders: {
                columns: [column('id', 'INTEGER', { autoIncrement: true }), column('customer_id', 'INTEGER'), column('total', 'INTEGER', { nullable: true })],
                primaryKey: ['id'],
                indexes: [{ name: 'PRIMARY', columns: ['id'], unique: true, primary: true }],
                foreignKeys: [
                    {
                        name: 'orders_customer',
                        columns: ['customer_id'],
                        referencedSchema: 'main',
                        referencedTable: 'customers',
                        referencedColumns: ['id'],
                        onUpdate: null,
                        onDelete: null
                    }
                ],
                rows: [[1, 1, 10]]
            }
        }
    }
};

export const SHOP_PATH = '/shop.sqlite';
