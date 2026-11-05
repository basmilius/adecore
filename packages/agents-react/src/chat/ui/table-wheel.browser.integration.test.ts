import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const frame = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))';

interface Scrolled {
    thread: number;
    table: number;
}

// Scroll chaining is the compositor's, so only a real wheel in a real browser shows where it lands.
test('a wheel over a table in the thread scrolls the thread down and the table sideways', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'adecore-table-wheel-'));
    let view: InstanceType<typeof Bun.WebView> | null = null;
    let server: ReturnType<typeof Bun.serve> | null = null;

    const resolve = (name: string) => JSON.stringify(Bun.resolveSync(name, import.meta.dir));

    try {
        const entry = join(directory, 'entry.tsx');

        await writeFile(
            entry,
            `
            import React from ${resolve('react')};
            import { createRoot } from ${resolve('react-dom/client')};
            import i18next from ${resolve('i18next')};
            import { UIProvider, ScrollArea } from ${resolve('@adecore/ui')};
            import { ChatHostProvider } from ${resolve('@adecore/agents-react')};
            import { Markdown } from ${resolve('@adecore/agents-react/chat/ui')};
            await i18next.init({lng:'en',resources:{en:{}}});
            const host={useStreaming:()=>'blocks'};
            const table=(columns)=>'| '+Array.from({length:columns},(_,i)=>'Column '+i).join(' | ')+' |\\n|'+' --- |'.repeat(columns)+'\\n| '+Array.from({length:columns},(_,i)=>'a cell with some words '+i).join(' | ')+' |\\n';
            createRoot(document.getElementById('root')).render(<UIProvider i18n={i18next}><ChatHostProvider host={host}>
                <div style={{height:400,display:'flex',flexDirection:'column'}}>
                    <ScrollArea id="thread">
                        <div style={{height:40}}/>
                        <div id="wide"><Markdown text={table(24)}/></div>
                        <div style={{height:40}}/>
                        <div id="narrow"><Markdown text={table(2)}/></div>
                        <div style={{height:2000}}/>
                    </ScrollArea>
                </div>
            </ChatHostProvider></UIProvider>);
            window.ready=true;
        `
        );

        const build = await Bun.build({
            entrypoints: [entry],
            target: 'browser',
            conditions: ['source'],
            plugins: [
                {
                    name: 'fixture-react',
                    setup(builder) {
                        builder.onResolve({ filter: /^react(\/.*)?$/ }, ({ path }) => ({ path: Bun.resolveSync(path, import.meta.dir) }));
                    }
                }
            ]
        });

        if (!build.success) {
            throw new AggregateError(build.logs, 'Could not bundle the table fixture');
        }

        const script = await build.outputs[0]!.text();
        const theme = await readFile(join(import.meta.dir, '../../../../ui/src/theme.css'), 'utf8');

        server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(request) {
                return new URL(request.url).pathname === '/entry.js'
                    ? new Response(script, { headers: { 'Content-Type': 'text/javascript' } })
                    : new Response(
                          `<!doctype html><style>${theme}body{margin:16px;width:600px}td,th{white-space:nowrap;padding:4px 8px}</style><div id="root"></div><script type="module" src="/entry.js"></script>`,
                          { headers: { 'Content-Type': 'text/html' } }
                      );
            }
        });

        view = new Bun.WebView({ backend: { type: 'chrome', url: false }, headless: true, dataStore: { directory: join(directory, 'profile') } });
        const browser = view;
        await browser.navigate(`http://127.0.0.1:${server.port}`);
        await browser.resize(900, 700);
        const deadline = Date.now() + 5000;

        while (!(await browser.evaluate<boolean>('window.ready===true&&document.querySelectorAll("table").length===2'))) {
            if (Date.now() > deadline) {
                throw new Error('The table fixture did not render');
            }

            await browser.evaluate<unknown>(frame);
        }

        const scrolled = (table: string): Promise<Scrolled> =>
            browser.evaluate<Scrolled>(
                `({thread:document.getElementById('thread').scrollTop,table:document.querySelector('#${table} .ade-scroll-viewport').scrollLeft})`
            );

        const wheel = async (table: string, deltaX: number, deltaY: number): Promise<Scrolled> => {
            await browser.evaluate<unknown>(
                `document.getElementById('thread').scrollTop=0,document.querySelector('#${table} .ade-scroll-viewport').scrollLeft=0`
            );
            await browser.evaluate<unknown>(frame);

            const point = await browser.evaluate<{ x: number; y: number }>(
                `(()=>{const rect=document.querySelector('#${table} table').getBoundingClientRect();return {x:rect.x+40,y:rect.y+rect.height/2};})()`
            );

            await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
            await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX, deltaY });
            const settle = Date.now() + 2000;
            let last = await scrolled(table);

            // A wheel lands over a few frames; it has settled once two frames in a row agree after something moved.
            while (Date.now() < settle) {
                await browser.evaluate<unknown>(frame);
                const next = await scrolled(table);

                if ((next.thread > 0 || next.table > 0) && next.thread === last.thread && next.table === last.table) {
                    break;
                }

                last = next;
            }

            return scrolled(table);
        };

        expect(
            await browser.evaluate<boolean>(
                `(()=>{const viewport=document.querySelector('#wide .ade-scroll-viewport');return viewport.scrollWidth>viewport.clientWidth;})()`
            )
        ).toBe(true);

        const wideDown = await wheel('wide', 0, 120);
        const wideSideways = await wheel('wide', 120, 0);
        const narrowDown = await wheel('narrow', 0, 120);

        expect(wideDown.thread).toBeGreaterThan(0);
        expect(wideDown.table).toBe(0);
        expect(wideSideways.table).toBeGreaterThan(0);
        expect(wideSideways.thread).toBe(0);
        expect(narrowDown.thread).toBeGreaterThan(0);
    } finally {
        view?.close();
        await server?.stop(true);
        await rm(directory, { recursive: true, force: true });
    }
});
