import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const frame = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))';

interface Box {
    top: number;
    height: number;
}

interface LineMeasure {
    chips: Array<Box & { kind: string; icon: Box | null; baseline: number; capCenter: number }>;
    text: Box & { baseline: number };
}

/* The CSS an app builds from Tailwind, the typography plugin and both themes, for the classes the page draws. */
async function compileStyles(candidates: string[]): Promise<string> {
    const docs = join(import.meta.dir, '../../../../../docs');
    const tailwind = Bun.resolveSync('@tailwindcss/node', Bun.resolveSync('@tailwindcss/vite', docs));
    const { compile } = (await import(tailwind)) as {
        compile(css: string, options: { base: string; onDependency(path: string): void }): Promise<{ build(candidates: string[]): string }>;
    };
    const themes = [join(import.meta.dir, '../../../../ui/src/theme.css'), join(import.meta.dir, '../../theme.css')];
    const source = [`@import 'tailwindcss';`, `@plugin '@tailwindcss/typography';`, ...themes.map((path) => `@import ${JSON.stringify(path)};`)].join('\n');
    const compiler = await compile(source, { base: docs, onDependency: () => undefined });
    return compiler.build(candidates);
}

test('every chip shares one box and one baseline, centered on its line, in a message, a reply and the composer', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'adecore-chips-'));
    let view: InstanceType<typeof Bun.WebView> | null = null;
    let server: ReturnType<typeof Bun.serve> | null = null;
    const resolve = (name: string) => JSON.stringify(Bun.resolveSync(name, import.meta.dir));
    const source = (path: string) => JSON.stringify(join(import.meta.dir, path));
    try {
        const entry = join(directory, 'entry.tsx');
        await writeFile(
            entry,
            `
            import React from ${resolve('react')};
            import { createRoot } from ${resolve('react-dom/client')};
            import i18next from ${resolve('i18next')};
            import { EditorView } from ${resolve('@codemirror/view')};
            import { EditorState } from ${resolve('@codemirror/state')};
            import { UIProvider } from ${resolve('@adecore/ui')};
            import { ChatHostProvider } from ${source('../../host.ts')};
            import { MessageMarkdown, ReplyMarkdown } from ${source('Markdown.tsx')};
            import { ReferenceLookupContext } from ${source('reference-lookup.ts')};
            import { composerEditorExtensions } from ${source('composer/editor.ts')};
            import { chipDecorations } from ${source('composer/chips.ts')};
            await i18next.init({lng:'en',resources:{en:{'agent-chat':{references:{gone:'Gone',untitled:'Untitled'}}}}});
            const items=[{id:'admin',name:'Admin',kind:'canvas',group:'views'}];
            const text='Ask @src/a.ts with $deploy on #Admin and #Missing now';
            const references=[{id:'admin',name:'Admin'},{id:'missing',name:'Missing'}];
            const host={useStreaming:()=>'blocks'};
            function Line({open}){
                return <ReferenceLookupContext value={{items,open}}>
                    <div className="max-w-[80%] rounded-2xl bg-surface-active px-3.5 py-2.5 text-sm wrap-anywhere text-text select-text">
                        <MessageMarkdown text={text} mentions={['src/a.ts']} skills={['deploy']} references={references}/>
                    </div>
                </ReferenceLookupContext>;
            }
            function Reply(){
                return <ReferenceLookupContext value={{items,open:()=>{},referenced:[]}}>
                    <ReplyMarkdown text={'The change is in #Admin now.'} streaming={false}/>
                </ReferenceLookupContext>;
            }
            createRoot(document.getElementById('root')).render(<UIProvider i18n={i18next}><ChatHostProvider host={host}>
                <div id="clickable"><Line open={()=>{}}/></div>
                <div id="still"><Line open={null}/></div>
                <div id="reply"><Reply/></div>
            </ChatHostProvider></UIProvider>);
            const parent=document.getElementById('composer');
            new EditorView({parent,state:EditorState.create({doc:'Ask @src/a.ts with $deploy on #Admin now',extensions:[composerEditorExtensions(),chipDecorations({mentions:['src/a.ts'],skills:['deploy'],references:[{id:'admin',name:'Admin',kind:'canvas'}]})]})});
            const box=(element)=>{const rect=element.getBoundingClientRect();return {top:rect.top,height:rect.height};};
            const words=(root)=>{
                const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
                const node=walker.nextNode();
                const range=document.createRange();
                range.setStart(node,0);range.setEnd(node,3);
                return box(range);
            };
            // A box of no height sits with its bottom on the baseline of the line it is in.
            const baselineAt=(parent,before)=>{
                const marker=document.createElement('span');
                marker.style.cssText='display:inline-block;width:0;height:0';
                parent.insertBefore(marker,before);
                const top=marker.getBoundingClientRect().top;
                marker.remove();
                return top;
            };
            // The height of a capital in the font the chip's name is drawn in, as the font itself gives it.
            const context=document.createElement('canvas').getContext('2d');
            const capHeight=(element)=>{
                context.font=getComputedStyle(element).font;
                return context.measureText('H').actualBoundingBoxAscent;
            };
            const chipOf=(kind,chip)=>{
                const baseline=baselineAt(chip,null);
                const svg=chip.querySelector('svg');
                return {kind,...box(chip),icon:svg===null?null:box(svg),baseline,capCenter:baseline-capHeight(chip)/2};
            };
            window.measure=(id)=>{
                const root=document.getElementById(id);
                const line=root.querySelector('p');
                const chips=[...root.querySelectorAll('[data-chip]')].map(chip=>chipOf(chip.dataset.chip,chip));
                return {chips,text:{...words(line),baseline:baselineAt(line,line.firstChild)}};
            };
            window.measureComposer=()=>{
                const root=document.getElementById('composer');
                const line=root.querySelector('.cm-line');
                const chips=[...root.querySelectorAll('.cm-line span.rounded-md')].map(chip=>chipOf(chip.className,chip));
                return {chips,text:{...words(line),baseline:baselineAt(line,line.firstChild)}};
            };
            window.setTextSize=(size)=>{
                for(const element of document.querySelectorAll('.chat-markdown, #composer')){element.style.fontSize=size;}
            };
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
            throw new AggregateError(build.logs, 'Could not bundle the chip fixture');
        }
        const script = await build.outputs[0]!.text();
        server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(request) {
                return new URL(request.url).pathname === '/entry.js'
                    ? new Response(script, { headers: { 'Content-Type': 'text/javascript' } })
                    : new Response(
                          `<!doctype html><body class="bg-bg p-4"><div id="root" class="w-[640px]"></div><div id="composer" class="composer-input mt-4 w-[640px] text-sm leading-normal text-text"></div><script type="module" src="/entry.js"></script></body>`,
                          { headers: { 'Content-Type': 'text/html' } }
                      );
            }
        });
        view = new Bun.WebView({ backend: { type: 'chrome', url: false }, headless: true, dataStore: { directory: join(directory, 'profile') } });
        const browser = view;
        await browser.navigate(`http://127.0.0.1:${server.port}`);
        await browser.resize(900, 700);
        const deadline = Date.now() + 5000;
        while (!(await browser.evaluate<boolean>('window.ready===true&&document.querySelectorAll("#reply [data-chip]").length>0'))) {
            if (Date.now() > deadline) {
                throw new Error('The chip fixture did not render');
            }
            await browser.evaluate<unknown>(frame);
        }
        const candidates = await browser.evaluate<string[]>('[...new Set([...document.querySelectorAll("[class]")].flatMap(element=>[...element.classList]))]');
        const css = await compileStyles(candidates);
        await browser.evaluate<unknown>(`document.head.append(Object.assign(document.createElement('style'),{textContent:${JSON.stringify(css)}}))`);
        await browser.evaluate<unknown>(frame);

        const expectAligned = (measured: LineMeasure, kinds: number): void => {
            expect(measured.chips).toHaveLength(kinds);
            const [first] = measured.chips;
            const textCenter = measured.text.top + measured.text.height / 2;
            for (const chip of measured.chips) {
                expect({ kind: chip.kind, top: Math.abs(chip.top - first!.top) <= 1, height: Math.abs(chip.height - first!.height) <= 1 }).toEqual({
                    kind: chip.kind,
                    top: true,
                    height: true
                });
                const center = chip.top + chip.height / 2;
                expect({
                    kind: chip.kind,
                    baseline: Math.abs(chip.baseline - measured.text.baseline) <= 0.5,
                    centered: Math.abs(center - textCenter) <= 1,
                    // On the middle of the name's capitals, which is what reads as centered beside them.
                    icon: chip.icon === null || Math.abs(chip.icon.top + chip.icon.height / 2 - chip.capCenter) <= 0.5
                }).toEqual({ kind: chip.kind, baseline: true, centered: true, icon: true });
            }
        };
        const measured: Record<string, Record<string, LineMeasure>> = {};
        // The message's own size, then the size of the chip's own text.
        for (const size of ['', '14px']) {
            await browser.evaluate<unknown>(`window.setTextSize(${JSON.stringify(size)})`);
            await browser.evaluate<unknown>(frame);
            const clickable = await browser.evaluate<LineMeasure>('window.measure("clickable")');
            const still = await browser.evaluate<LineMeasure>('window.measure("still")');
            const reply = await browser.evaluate<LineMeasure>('window.measure("reply")');
            const composer = await browser.evaluate<LineMeasure>('window.measureComposer()');
            measured[size || 'message'] = { clickable, still, reply, composer };
            if (process.env.CHIPS_REPORT === '1') {
                console.log(JSON.stringify(measured));
            }
            expectAligned(clickable, 4);
            expectAligned(still, 4);
            expectAligned(reply, 1);
            expectAligned(composer, 3);
            // The same box wherever a chip is drawn in the transcript.
            expect(Math.abs(reply.chips[0]!.height - clickable.chips[0]!.height)).toBeLessThanOrEqual(1);
            expect(Math.abs(still.chips[2]!.height - clickable.chips[2]!.height)).toBeLessThanOrEqual(1);
        }
    } finally {
        view?.close();
        await server?.stop(true);
        await rm(directory, { recursive: true, force: true });
    }
});
