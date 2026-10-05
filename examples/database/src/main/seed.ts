/* A small shop. Statements are split on semicolons by the helper, so none may contain one inside a string. */
export const SEED_SQL = `
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    thumbnail BLOB,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    placed_at TEXT NOT NULL
);

CREATE TABLE order_lines (
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products (id),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    PRIMARY KEY (order_id, line_no)
);

CREATE TABLE audit_log (
    at TEXT NOT NULL,
    actor TEXT,
    action TEXT NOT NULL,
    detail TEXT
);

CREATE INDEX idx_customers_country ON customers (country);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status_placed ON orders (status, placed_at);
CREATE INDEX idx_order_lines_product ON order_lines (product_id);

INSERT INTO customers (name, email, country, created_at, notes)
WITH RECURSIVE seq (n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 501
)
SELECT
    'Customer ' || n,
    'customer' || n || '@example.com',
    CASE n % 5 WHEN 0 THEN 'NL' WHEN 1 THEN 'DE' WHEN 2 THEN 'BE' WHEN 3 THEN 'FR' ELSE 'GB' END,
    datetime('2024-01-01', '+' || n || ' hours'),
    CASE WHEN n % 7 = 0 THEN 'Prefers invoices by mail' ELSE NULL END
FROM seq;

INSERT INTO products (sku, name, description, price_cents, thumbnail, active) VALUES
    ('KB-001', 'Mechanical keyboard', replace(hex(zeroblob(1500)), '00', 'A compact board with hot-swappable switches. '), 12900, x'89504e470d0a1a0a0000000d49484452', 1),
    ('MS-002', 'Wireless mouse', 'Light, quiet and good for a week on one charge.', 4900, x'89504e470d0a1a0a0000000d49484452', 1),
    ('MN-003', 'Monitor 27 inch', 'A 4K panel with a matte coating.', 32900, NULL, 1),
    ('HD-004', 'Headphones', 'Closed back, 40 hour battery.', 17900, NULL, 1),
    ('CB-005', 'USB-C cable 2 m', NULL, 1500, NULL, 1),
    ('DK-006', 'Docking station', 'Two displays over one cable.', 21900, NULL, 1),
    ('WC-007', 'Webcam', 'Full HD with a privacy shutter.', 7900, NULL, 1),
    ('MP-008', 'Desk mat', 'Felt, 90 by 40 cm.', 2900, NULL, 1),
    ('LP-009', 'Laptop stand', 'Aluminum, folds flat.', 3900, NULL, 1),
    ('SP-010', 'Speakers', 'Pair of powered desktop speakers.', 8900, NULL, 0),
    ('HB-011', 'USB hub', 'Four ports, no cable.', 2400, NULL, 1),
    ('LM-012', 'Desk lamp', 'Dimmable, warm to cool.', 5400, NULL, 1);

INSERT INTO orders (customer_id, status, placed_at)
WITH RECURSIVE seq (n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 800
)
SELECT
    (n * 7) % 501 + 1,
    CASE n % 4 WHEN 0 THEN 'pending' WHEN 1 THEN 'paid' WHEN 2 THEN 'shipped' ELSE 'delivered' END,
    datetime('2025-01-01', '+' || (n * 3) || ' hours')
FROM seq;

INSERT INTO order_lines (order_id, line_no, product_id, quantity, unit_price_cents)
SELECT o.id, 1, p.id, 1 + o.id % 3, p.price_cents
FROM orders o JOIN products p ON p.id = 1 + o.id % 12;

INSERT INTO order_lines (order_id, line_no, product_id, quantity, unit_price_cents)
SELECT o.id, 2, p.id, 1, p.price_cents
FROM orders o JOIN products p ON p.id = 1 + (o.id * 5) % 12;

CREATE VIEW order_totals AS
SELECT
    o.id AS order_id,
    c.name AS customer,
    o.status,
    COUNT(l.line_no) AS line_count,
    COALESCE(SUM(l.quantity * l.unit_price_cents), 0) AS total_cents
FROM orders o
JOIN customers c ON c.id = o.customer_id
LEFT JOIN order_lines l ON l.order_id = o.id
GROUP BY o.id;

INSERT INTO audit_log (at, actor, action, detail)
WITH RECURSIVE seq (n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 30
)
SELECT
    datetime('2025-06-01', '+' || n || ' minutes'),
    CASE n % 3 WHEN 0 THEN 'system' ELSE 'admin' END,
    CASE n % 2 WHEN 0 THEN 'order.update' ELSE 'customer.update' END,
    'Changed record ' || n
FROM seq
`;
