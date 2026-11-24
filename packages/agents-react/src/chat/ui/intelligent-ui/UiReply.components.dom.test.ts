import { afterEach, beforeEach, expect, setSystemTime, test } from 'bun:test';
import type { ChatUiDiffPayload, ChatUiDiffReading } from '@adecore/agent-contracts';
import { compileUi, type UiNode } from '@adecore/intelligent-ui';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatHostProvider, type ChatHost } from '../../../host/host';
import { UI_DIFF_LINES } from './renderers/diff';
import { UiReply } from './UiReply';
import { UI_OPEN_DIFFS } from './use-ui-diffs';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

type UiHost = NonNullable<ChatHost['intelligentUi']>;

let scopes = 0;

/* The `path` each node of the mounted block was written with, by node id: what a backend reads from the block it stored. */
const paths = new Map<string, string>();

function recordPaths(nodes: readonly UiNode[]): void {
    for (const node of nodes) {
        if (typeof node.props.path === 'string') {
            paths.set(node.id, node.props.path);
        }

        recordPaths(node.children);
    }
}

/* A finished block of `source` in a page, with `intelligentUi` as its host; every mount is a scope of its own, so no fold or input is remembered from another test. */
async function mount(source: string, intelligentUi: Partial<UiHost> = {}) {
    const observer = globalThis.IntersectionObserver;
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    const text = '```ui\n' + source + '\n```';
    const compiled = (reply: string, final: boolean) => compileUi(reply, { id: 'components', final }).map((block) => ({ ...block, revision: 'revision' }));
    const blocks = compiled(text, true);
    const host: Partial<ChatHost> = { intelligentUi: { sendChoice: async () => 'sent', ...intelligentUi } };
    paths.clear();
    recordPaths(blocks[0]!.nodes);
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    const scopeId = `components-${scopes++}`;

    const draw = (reply: string, drawn: typeof blocks, phase: 'streaming' | 'final') =>
        act(async () =>
            root.render(
                createElement(
                    ChatHostProvider,
                    { host },
                    createElement(UiReply, { text: reply, blocks: drawn, context: { scopeId, chatId: 'chat', itemId: 'item', phase } })
                )
            )
        );

    await draw(text, blocks, 'final');

    return {
        element,
        /* Draws the block again as a reply that has streamed in only as far as `partial`. */
        streamed: (partial: string) => draw('```ui\n' + partial, compiled('```ui\n' + partial, false), 'streaming'),
        finished: () => draw(text, blocks, 'final'),
        button: (label: string) => [...element.querySelectorAll('button')].find((button) => button.textContent?.trim() === label),
        /* Lets a timer of no delay run, which is how a block first checks its links. */
        settle: () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0)))),
        unmount: async () => {
            await act(async () => root.unmount());
            element.remove();
            Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: observer });
        }
    };
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    // React tracks the value through the prototype's setter, so a plain assignment would not look like typing.
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(element: Element, key: string): void {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

test('a radio group takes a click and the arrow keys, and a Choice carries the pick', async () => {
    const sent: unknown[] = [];

    const view = await mount(
        '$scope = "fast"\n<Radio value={$scope}><Option value="fast">Fast</Option><Option value="full">Full</Option><Option value="none">None</Option></Radio><Choices><Choice>Run</Choice></Choices>',
        {
            sendChoice: async (_scope, payload) => {
                sent.push(payload.values);

                return 'sent';
            }
        }
    );

    try {
        const radios = () => [...view.element.querySelectorAll<HTMLElement>('[role="radio"]')];
        const checked = () => radios().map((radio) => radio.getAttribute('aria-checked'));

        expect(checked()).toEqual(['true', 'false', 'false']);
        await act(async () => radios()[1]!.click());
        expect(checked()).toEqual(['false', 'true', 'false']);
        await act(async () => press(radios()[1]!, 'ArrowDown'));
        expect(checked()).toEqual(['false', 'false', 'true']);
        expect(document.activeElement).toBe(radios()[2]!);
        expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, 0]);
        // Past the last one the choice wraps to the first, and back.
        await act(async () => press(radios()[2]!, 'ArrowRight'));
        expect(checked()).toEqual(['true', 'false', 'false']);
        await act(async () => press(radios()[0]!, 'ArrowUp'));
        expect(checked()).toEqual(['false', 'false', 'true']);
        await act(async () => press(radios()[1]!, ' '));
        expect(checked()).toEqual(['false', 'true', 'false']);
        await act(async () => view.button('Run')!.click());
        expect(sent).toEqual([{ $scope: 'full' }]);
        // An answered block is closed: a click changes nothing.
        await act(async () => radios()[0]!.click());
        expect(checked()).toEqual(['false', 'true', 'false']);
    } finally {
        await view.unmount();
    }
});

test('a number field writes only a number inside its range', async () => {
    const sent: unknown[] = [];

    const view = await mount('$runs = 50\n<NumberField value={$runs} min={1} max={500} unit="runs">Runs</NumberField><Choices><Choice>Run</Choice></Choices>', {
        sendChoice: async (_scope, payload) => {
            sent.push(payload.values);

            return 'sent';
        }
    });

    try {
        const input = () => view.element.querySelector<HTMLInputElement>('input')!;

        expect(input().value).toBe('50');
        await act(async () => type(input(), '120'));
        expect(input().value).toBe('120');
        expect(input().getAttribute('aria-invalid')).toBeNull();
        await act(async () => type(input(), '900'));
        expect(input().getAttribute('aria-invalid')).toBe('true');
        expect(view.element.textContent).toContain('A number from 1 to 500');
        await act(async () => type(input(), ''));
        expect(input().getAttribute('aria-invalid')).toBe('true');
        // Leaving the field puts back the last number it took.
        await act(async () => input().dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
        expect(input().value).toBe('120');
        expect(view.element.textContent).not.toContain('A number from');
        await act(async () => view.button('Run')!.click());
        expect(sent).toEqual([{ $runs: 120 }]);
    } finally {
        await view.unmount();
    }
});

test('a branch folds and unfolds what is under it', async () => {
    const view = await mount('<Tree><Branch label="src"><Leaf>compiler.ts</Leaf></Branch></Tree>');

    try {
        const branch = view.button('src')!;
        const list = view.element.querySelector<HTMLElement>(`#${CSS.escape(branch.getAttribute('aria-controls')!)}`)!;

        expect(branch.getAttribute('aria-expanded')).toBe('true');
        expect(list.hidden).toBe(false);
        await act(async () => branch.click());
        expect(branch.getAttribute('aria-expanded')).toBe('false');
        expect(list.hidden).toBe(true);
        await act(async () => branch.click());
        expect(list.hidden).toBe(false);
    } finally {
        await view.unmount();
    }
});

test('a changed file and a leaf with a path open through the host once it resolved them', async () => {
    const opened: unknown[] = [];

    const view = await mount('<Changes><Change path="src/a.ts" added={2}/></Changes><Tree><Leaf path="src/b.ts"/><Leaf>plain</Leaf></Tree>', {
        link: async (_scope, payload) => {
            const path = paths.get(payload.nodeId)!;

            return { state: 'chip', target: { type: path === 'src/a.ts' ? 'Diff' : 'File', path } };
        },
        openLink: (_scope, reading) => opened.push(reading.target)
    });

    try {
        expect(view.element.querySelectorAll('button')).toHaveLength(0);
        await view.settle();
        const row = [...view.element.querySelectorAll('button')].find((button) => button.textContent?.includes('src/a.ts'))!;
        await act(async () => row.click());
        await act(async () => view.button('b.ts')!.click());
        expect(opened).toEqual([
            { type: 'Diff', path: 'src/a.ts' },
            { type: 'File', path: 'src/b.ts' }
        ]);
        expect(view.button('plain')).toBeUndefined();
    } finally {
        await view.unmount();
    }
});

const PATCH = ['--- a/src/a.ts', '+++ b/src/a.ts', '@@ -1,2 +1,2 @@', ' keep', '-old', '+new', ''].join('\n');

test('an open Diff asks the host by its node, waits quietly and then shows the change in a tile', async () => {
    const asked: ChatUiDiffPayload[] = [];
    let answer: (reading: ChatUiDiffReading) => void = () => {};

    const source =
        '$flag = true\n<Switch value={$flag}>Flag</Switch><Diff path="src/a.ts" open from="main" whitespace="hide">Reads a number</Diff><Diff path="src/closed.ts"/>';

    const view = await mount(source, {
        diff: (_scope, payload) => {
            asked.push(payload);

            return new Promise((resolve) => {
                answer = resolve;
            });
        }
    });

    try {
        expect(asked).toHaveLength(1);
        expect(asked[0]).toMatchObject({ chatId: 'chat', itemId: 'item', revision: 'revision', values: { $flag: true }, reads: {} });
        // Only the node goes to the host, which reads the path and the revisions from the block it stored.
        expect(paths.get(asked[0]!.nodeId)).toBe('src/a.ts');
        expect(Object.keys(asked[0]!).sort()).toEqual(['blockId', 'chatId', 'itemId', 'nodeId', 'reads', 'revision', 'values']);
        expect(view.element.querySelector('figure')).toBeNull();
        expect(view.element.querySelector('[role="status"], [aria-label="Loading diff"]')).not.toBeNull();
        expect(view.element.textContent).toContain('Reads a number');
        await act(async () => answer({ state: 'patch', patch: PATCH }));
        const tile = view.element.querySelector('figure')!;
        expect(tile.getAttribute('aria-label')).toBe('Changes in src/a.ts');
        expect(tile.querySelector('figcaption')!.textContent).toContain('Reads a number');
        expect(view.element.querySelector('[aria-label="Loading diff"]')).toBeNull();
        expect(view.element.textContent).not.toContain('Only the first lines are shown.');
        expect(asked).toHaveLength(1);
    } finally {
        await view.unmount();
    }
});

test('a long or cut patch offers the whole diff through the link, and a refused one stays text', async () => {
    const opened: unknown[] = [];
    const long = [
        '--- a/long.ts',
        '+++ b/long.ts',
        `@@ -0,0 +1,${UI_DIFF_LINES + 5} @@`,
        ...Array.from({ length: UI_DIFF_LINES + 5 }, (_, i) => `+line ${i}`)
    ].join('\n');

    const view = await mount('<Diff path="long.ts" open/><Diff path="cut.ts" open/><Diff path="secret.ts" open/>', {
        diff: async (_scope, payload) => {
            switch (paths.get(payload.nodeId)) {
                case 'long.ts':
                    return { state: 'patch', patch: long };
                case 'cut.ts':
                    return { state: 'patch', patch: PATCH, truncated: true };
                default:
                    return { state: 'refused', code: 'outside-project', reason: 'Outside.' };
            }
        },
        link: async (_scope, payload) => ({ state: 'chip', target: { type: 'Diff', path: paths.get(payload.nodeId)! } }),
        openLink: (_scope, reading) => opened.push(reading.target)
    });

    try {
        await view.settle();
        const tiles = [...view.element.querySelectorAll('figure')];
        expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['Changes in long.ts', 'Changes in cut.ts']);

        for (const tile of tiles) {
            expect(tile.textContent).toContain('Only the first lines are shown.');
        }

        const whole = [...view.element.querySelectorAll('button')].filter((button) => button.textContent === 'Open the whole diff');
        expect(whole).toHaveLength(2);
        await act(async () => whole[0]!.click());
        expect(opened).toEqual([{ type: 'Diff', path: 'long.ts' }]);
        // The refused one is the path as text, focusable for the reason in its tooltip, and no button.
        const refused = [...view.element.querySelectorAll<HTMLElement>('span[tabindex="0"]')].find((span) => span.textContent === 'secret.ts')!;
        expect(refused.closest('button')).toBeNull();
        expect(refused.closest('figure')).toBeNull();
    } finally {
        await view.unmount();
    }
});

test('a host that reads no diffs is never asked, and a block opens only its first few', async () => {
    const plain = await mount('<Diff path="src/a.ts" open/>');

    try {
        expect(plain.element.querySelector('figure')).toBeNull();
        expect(plain.element.textContent).toContain('src/a.ts');
    } finally {
        await plain.unmount();
    }

    const asked: string[] = [];
    const many = Array.from({ length: UI_OPEN_DIFFS + 2 }, (_, index) => `<Diff path="src/${index}.ts" open/>`).join('');

    const view = await mount(many, {
        diff: async (_scope, payload) => {
            asked.push(payload.nodeId);

            return { state: 'refused' };
        }
    });

    try {
        expect(asked).toHaveLength(UI_OPEN_DIFFS);
    } finally {
        await view.unmount();
    }
});

test('a column head sorts the table by its column, up and then down, and says so', async () => {
    const view = await mount(
        '<Table rows={[{"job": "Unit", "ms": 262000}, {"job": "DOM", "ms": 41000}, {"job": "Types", "ms": 97000}]}><Column key="job" title="Job"/><Column key="ms" title="Duration" as="duration"/></Table>'
    );

    try {
        const jobs = () => [...view.element.querySelectorAll('tbody tr')].map((row) => row.querySelector('td')!.textContent);
        const head = (title: string) => view.button(title)!.closest('th')!;

        expect(jobs()).toEqual(['Unit', 'DOM', 'Types']);
        expect(head('Duration').hasAttribute('aria-sort')).toBe(false);
        await act(async () => view.button('Duration')!.click());
        expect(jobs()).toEqual(['DOM', 'Types', 'Unit']);
        expect(head('Duration').getAttribute('aria-sort')).toBe('ascending');
        await act(async () => view.button('Duration')!.click());
        expect(jobs()).toEqual(['Unit', 'Types', 'DOM']);
        expect(head('Duration').getAttribute('aria-sort')).toBe('descending');
        await act(async () => view.button('Job')!.click());
        expect(jobs()).toEqual(['DOM', 'Types', 'Unit']);
        expect(head('Job').getAttribute('aria-sort')).toBe('ascending');
        expect(head('Duration').hasAttribute('aria-sort')).toBe(false);
    } finally {
        await view.unmount();
    }
});

test('a section and a branch whose tag streams in follow open once it is read, until a person folds them', async () => {
    const view = await mount(
        '<Sections><Section title="Risks" open={false}>None found</Section></Sections><Tree><Branch label="src" open={false}><Leaf>a.ts</Leaf></Branch></Tree>'
    );

    try {
        await view.streamed('<Sections><Section title="Risks"');
        expect(view.button('Risks')!.getAttribute('aria-expanded')).toBe('true');
        await view.finished();
        expect(view.button('Risks')!.getAttribute('aria-expanded')).toBe('false');
        expect(view.button('src')!.getAttribute('aria-expanded')).toBe('false');
        await act(async () => view.button('Risks')!.click());
        await view.finished();
        expect(view.button('Risks')!.getAttribute('aria-expanded')).toBe('true');
    } finally {
        await view.unmount();
    }
});

test('a section that arrives closed opens on a press, and leaves the one beside it as it was', async () => {
    const view = await mount('<Sections><Section title="Risks" open={false}>None found</Section><Section title="Details">Three handlers</Section></Sections>');

    try {
        const body = (title: string) => view.element.querySelector<HTMLElement>(`#${CSS.escape(view.button(title)!.getAttribute('aria-controls')!)}`)!;

        expect(view.button('Risks')!.getAttribute('aria-expanded')).toBe('false');
        expect(body('Risks').hidden).toBe(true);
        expect(body('Details').hidden).toBe(false);
        await act(async () => view.button('Risks')!.click());
        expect(view.button('Risks')!.getAttribute('aria-expanded')).toBe('true');
        expect(body('Risks').hidden).toBe(false);
        expect(body('Details').hidden).toBe(false);
    } finally {
        await view.unmount();
    }
});

test('a multiline text field keeps its lines up to its limit, and a Choice carries them', async () => {
    const sent: unknown[] = [];

    const view = await mount(
        '$note = ""\n<TextField value={$note} maxLength={12} multiline>Note</TextField><Choices><Choice context={"Note: " + $note}>Send</Choice></Choices>',
        {
            sendChoice: async (_scope, payload) => {
                sent.push(payload.values);

                return 'sent';
            }
        }
    );

    try {
        const field = () => view.element.querySelector('textarea')!;

        await act(async () => type(field(), 'one\ntwo'));
        expect(field().value).toBe('one\ntwo');
        expect(field().maxLength).toBe(12);
        await act(async () => view.element.querySelector<HTMLButtonElement>('[role="group"][aria-label="Choices"] button')!.click());
        expect(sent).toEqual([{ $note: 'one\ntwo' }]);
        expect(field().disabled).toBe(true);
    } finally {
        await view.unmount();
    }
});

test('the file of a code block opens through the host at its first line once the host resolved it', async () => {
    const opened: unknown[] = [];

    const view = await mount('<CodeBlock language="ts" file="src/total.ts" start={12}>const total = rows.length;</CodeBlock>', {
        link: async () => ({ state: 'chip', target: { type: 'File', path: 'src/total.ts', line: 12 } }),
        openLink: (_scope, reading) => opened.push(reading.target)
    });

    try {
        await view.settle();
        await act(async () => view.button('total.ts:12')!.click());
        expect(opened).toEqual([{ type: 'File', path: 'src/total.ts', line: 12 }]);
    } finally {
        await view.unmount();
    }
});
