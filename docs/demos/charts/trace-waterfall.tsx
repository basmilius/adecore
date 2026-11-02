import { Timeline, type TimelineKind, type TimelineSpan } from '@adecore/charts';
import { formatPercent, formatPreciseDuration } from '@adecore/ui/format';

interface TraceSpan extends TimelineSpan {
    readonly op: string;
    readonly ok: boolean;
}

const START = Date.UTC(2026, 9, 24, 14, 12, 3, 120);

function span(id: string, parent: string | null, op: string, label: string, offset: number, duration: number, ok = true): TraceSpan {
    return {
        id,
        parent,
        op,
        label,
        start: START + offset,
        duration,
        kind: op.startsWith('db') ? 'db' : op.startsWith('http') ? 'http' : 'code',
        tone: ok ? undefined : 'error',
        ok
    };
}

/* An order page: two queries up front, the price worked out by a service that calls the tax API, and a payment check that times out. */
const SPANS: TraceSpan[] = [
    span('a1', null, 'http.server', 'GET /api/orders/1842', 0, 412),
    span('b1', 'a1', 'middleware', 'Authenticate', 2, 18),
    span('b2', 'b1', 'db.query', 'SELECT * FROM sessions WHERE token = ?', 4, 9),
    span('b3', 'a1', 'db.query', 'SELECT * FROM orders WHERE id = ?', 22, 31),
    span('b4', 'a1', 'db.query', 'SELECT * FROM order_lines WHERE order_id = ?', 55, 14),
    span('c1', 'a1', 'function', 'OrderService.price', 72, 168),
    span('c2', 'c1', 'db.query', 'SELECT * FROM discounts WHERE code IN (?)', 75, 6.4),
    span('c3', 'c1', 'http.client', 'POST tax.example.com/v2/quote', 84, 141),
    span('c4', 'c1', 'function', 'Money.round', 228, 0.8),
    span('d1', 'a1', 'http.client', 'GET payments.example.com/status', 244, 150, false),
    span('e1', 'a1', 'template', 'Render order.json', 396, 14)
];

const KINDS: TimelineKind[] = [
    { id: 'db', label: 'Database' },
    { id: 'http', label: 'Network' },
    { id: 'code', label: 'Code' }
];

const TIMEOUT = START + 394;
const TOTAL = 412;

function SpanDetail({ span: detail }: { span: TraceSpan }) {
    const facts = [
        { name: 'Operation', value: detail.op },
        { name: 'Starts at', value: `+${formatPreciseDuration(detail.start - START)}` },
        { name: 'Duration', value: `${formatPreciseDuration(detail.duration)}, ${formatPercent((detail.duration / TOTAL) * 100)} of the trace` },
        { name: 'Status', value: detail.ok ? 'OK' : 'Failed' },
        { name: 'Span id', value: detail.id }
    ];

    return (
        <>
            <p className="mb-3 font-mono text-code break-all text-text">{detail.label}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs @xl:grid-cols-3 @3xl:grid-cols-5">
                {facts.map((fact) => (
                    <div key={fact.name} className="min-w-0">
                        <dt className="text-text-muted">{fact.name}</dt>
                        <dd className="truncate text-text tabular-nums">{fact.value}</dd>
                    </div>
                ))}
            </dl>
        </>
    );
}

export default function TraceWaterfallDemo() {
    return (
        <div className="w-full overflow-hidden rounded-lg border border-border">
            <Timeline.Root
                data={SPANS}
                kinds={KINDS}
                label="Spans of GET /api/orders/1842"
                end={START + TOTAL}
                defaultValue="d1"
                defaultExpanded={['a1', 'c1']}
            >
                <Timeline.Legend />
                <Timeline.Axis heading="Span">
                    <Timeline.Moment at={TIMEOUT} label="SHOP-212 Payment status timed out" />
                </Timeline.Axis>
                <Timeline.Rows
                    label={(row: TraceSpan) => (
                        <>
                            <span className="shrink-0 text-xs text-text-muted">{row.op}</span>
                            <span className="min-w-0 truncate font-mono text-code text-text">{row.label}</span>
                        </>
                    )}
                    detail={(row: TraceSpan) => <SpanDetail span={row} />}
                />
            </Timeline.Root>
        </div>
    );
}
