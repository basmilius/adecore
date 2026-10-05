import { createDatabaseClient, type Connection } from '@adecore/database';
import { fakeDatabaseTransport, type FakeDatabase } from '@adecore/database/testing';
import type { ColumnInfo, DockerContainer, ValueKind } from '@adecore/database/protocol';

const column = (name: string, type: string, kind: ValueKind, extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
    name,
    type,
    kind,
    nullable: false,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null,
    ...extra
});

const id = (): ColumnInfo => column('id', 'integer', 'integer', { autoIncrement: true });

/* The tables of a small shop in one schema: `main` in SQLite, `shop` in MySQL. */
const shopDatabase = (schema: string): FakeDatabase => ({
    schemas: {
        [schema]: {
            customers: {
                columns: [
                    id(),
                    column('name', 'varchar(120)', 'text'),
                    column('email', 'varchar(255)', 'text'),
                    column('country', 'char(2)', 'text', { nullable: true }),
                    column('created_at', 'datetime', 'datetime', { defaultValue: 'CURRENT_TIMESTAMP' })
                ],
                primaryKey: ['id'],
                indexes: [
                    { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
                    { name: 'customers_email', columns: ['email'], unique: true, primary: false }
                ],
                ddl: 'CREATE TABLE customers (\n  id integer PRIMARY KEY AUTOINCREMENT,\n  name varchar(120) NOT NULL,\n  email varchar(255) NOT NULL UNIQUE,\n  country char(2),\n  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP\n)',
                rows: [
                    [1, 'Amara Okafor', 'amara@example.com', 'NG', '2026-01-12 09:14:03'],
                    [2, 'Bram de Vries', 'bram@example.nl', 'NL', '2026-01-19 16:40:51'],
                    [3, 'Chen Wei', 'chen.wei@example.com', 'SG', '2026-02-02 11:02:27'],
                    [4, 'Dalia Haddad', 'dalia@example.com', null, '2026-02-14 08:55:10'],
                    [5, 'Elif Demir', 'elif@example.com', 'TR', '2026-03-03 19:21:44'],
                    [6, 'Felix Brandt', 'felix@example.de', 'DE', '2026-03-21 13:37:09'],
                    [7, 'Grace Mwangi', 'grace@example.com', 'KE', '2026-04-08 10:05:32'],
                    [8, 'Hugo Martin', 'hugo@example.fr', 'FR', '2026-04-30 17:48:18']
                ]
            },
            products: {
                columns: [
                    id(),
                    column('sku', 'varchar(32)', 'text'),
                    column('name', 'varchar(120)', 'text'),
                    column('price', 'decimal(10,2)', 'decimal'),
                    column('stock', 'int', 'integer', { defaultValue: '0' }),
                    column('active', 'tinyint(1)', 'boolean', { defaultValue: '1' }),
                    column('description', 'text', 'text', { nullable: true })
                ],
                primaryKey: ['id'],
                indexes: [
                    { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
                    { name: 'products_sku', columns: ['sku'], unique: true, primary: false }
                ],
                rows: [
                    [1, 'MUG-001', 'Enamel mug', '14.50', 120, true, 'A 350 ml enamel mug with a steel rim.'],
                    [2, 'TEE-014', 'Organic cotton tee', '29.00', 48, true, null],
                    [3, 'BAG-203', 'Canvas tote', '19.95', 0, false, 'Waxed canvas, two inner pockets.'],
                    [4, 'NTB-007', 'Dotted notebook', '9.50', 310, true, null],
                    [5, 'PEN-120', 'Brass pen', '34.00', 22, true, 'Machined from a single bar of brass.'],
                    [6, 'CAP-031', 'Wool cap', '24.00', 15, true, null]
                ]
            },
            orders: {
                columns: [
                    id(),
                    column('customer_id', 'integer', 'integer'),
                    column('status', 'varchar(16)', 'text', { defaultValue: "'pending'" }),
                    column('total', 'decimal(10,2)', 'decimal'),
                    column('placed_at', 'datetime', 'datetime', { defaultValue: 'CURRENT_TIMESTAMP' }),
                    column('note', 'text', 'text', { nullable: true })
                ],
                primaryKey: ['id'],
                indexes: [
                    { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
                    { name: 'orders_customer', columns: ['customer_id'], unique: false, primary: false }
                ],
                foreignKeys: [
                    {
                        name: 'orders_customer_fk',
                        columns: ['customer_id'],
                        referencedSchema: schema,
                        referencedTable: 'customers',
                        referencedColumns: ['id'],
                        onUpdate: null,
                        onDelete: 'CASCADE'
                    }
                ],
                ddl: "CREATE TABLE orders (\n  id integer PRIMARY KEY AUTOINCREMENT,\n  customer_id integer NOT NULL REFERENCES customers (id) ON DELETE CASCADE,\n  status varchar(16) NOT NULL DEFAULT 'pending',\n  total decimal(10,2) NOT NULL,\n  placed_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  note text\n)",
                rows: [
                    [1, 2, 'shipped', '43.50', '2026-05-02 10:12:00', null],
                    [2, 5, 'shipped', '29.00', '2026-05-04 15:30:21', 'Gift wrap, please.'],
                    [3, 1, 'pending', '68.00', '2026-05-09 08:47:55', null],
                    [4, 3, 'cancelled', '19.95', '2026-05-11 12:03:40', 'Out of stock.'],
                    [5, 2, 'pending', '9.50', '2026-05-12 18:21:09', null],
                    [6, 7, 'shipped', '58.00', '2026-05-14 09:09:09', null]
                ]
            },
            order_totals: {
                kind: 'view',
                columns: [column('customer_id', 'integer', 'integer'), column('orders', 'integer', 'integer'), column('spent', 'decimal(10,2)', 'decimal')],
                ddl: "CREATE VIEW order_totals AS\n  SELECT customer_id, count(*) AS orders, sum(total) AS spent\n  FROM orders WHERE status <> 'cancelled' GROUP BY customer_id",
                rows: [
                    [1, 1, '68.00'],
                    [2, 2, '53.00'],
                    [5, 1, '29.00'],
                    [7, 1, '58.00']
                ]
            },
            audit_log: {
                columns: [column('at', 'datetime', 'datetime'), column('actor', 'varchar(64)', 'text'), column('action', 'varchar(64)', 'text')],
                rows: [
                    ['2026-05-14 09:10:02', 'system', 'order.shipped'],
                    ['2026-05-14 09:12:40', 'amara', 'product.update']
                ]
            }
        }
    }
});

/* A SQLite file and a MySQL server that hold the same small shop. */
export const SHOP_CONNECTIONS: readonly Connection[] = [
    { id: 'shop', name: 'Shop', config: { engine: 'sqlite', path: '/Users/demo/shop.sqlite' } },
    { id: 'staging', name: 'Staging', config: { engine: 'mysql', host: 'staging.example.com', user: 'shop', database: 'shop', tls: 'require' } }
];

export const SHOP: Connection = SHOP_CONNECTIONS[0]!;

/* A read only copy of the same file, for the demos about what a person cannot change. */
export const SHOP_READ_ONLY: Connection = {
    id: 'shop-read-only',
    name: 'Shop (read only)',
    config: { engine: 'sqlite', path: '/Users/demo/shop.sqlite', readOnly: true }
};

/* A connection set to reach its server through a Docker container nobody has picked yet, for the form's Docker mode. */
export const SHOP_DOCKER: Connection = {
    id: 'local',
    name: 'Local database',
    config: { engine: 'mysql', host: '127.0.0.1', user: '', tunnel: { kind: 'docker', container: '', port: 3306 } }
};

/* What `discover` lists in the demos: a Compose service that publishes its port, and a container that publishes nothing. */
export const SHOP_CONTAINERS: readonly DockerContainer[] = [
    {
        id: '4f1c0e8a2b7d',
        name: 'shop-db-1',
        image: 'mariadb:11',
        engine: 'mysql',
        ports: [{ container: 3306, host: 33061 }],
        project: 'shop',
        service: 'db',
        suggested: { user: 'shop', password: 'shop', database: 'shop' }
    },
    {
        id: '9b3d51c7e402',
        name: 'legacy-mysql',
        image: 'mysql:8.4',
        engine: 'mysql',
        ports: [{ container: 3306, host: null }],
        project: null,
        service: null,
        suggested: { user: 'root', password: 'secret' }
    }
];

export const createShopClient = () =>
    createDatabaseClient(
        fakeDatabaseTransport({
            latencyMs: 120,
            containers: SHOP_CONTAINERS,
            // A connection through Docker keeps its host, `127.0.0.1` by default, and the fake finds a server by host.
            databases: {
                '/Users/demo/shop.sqlite': shopDatabase('main'),
                'staging.example.com': shopDatabase('shop'),
                '127.0.0.1': shopDatabase('shop')
            }
        })
    );
