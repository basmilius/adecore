import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { compileUiBlock, evaluateUiBlock, UI_CATALOG, UiState, type UiComponentName, type UiViewNode } from '@adecore/intelligent-ui';
import { formatClock, formatDay, formatDayClock, formatDayClockWithYear, formatDayWithYear, setFormatSource, type FormatSource } from '@adecore/ui/format';
import { fakeFormatSource } from '@adecore/ui/testing';
import i18next from 'i18next';
import { createElement, Fragment, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHostProvider, type ChatHost, type UiModelViewProps } from '../../../host/host';
import { UiPageMemory } from './block-local';
import { uiChartAxis, uiChartCharacter, uiChartData, uiChartRange, uiChartText, uiChartTextWidth, niceCeiling, UI_CHART_SERIES } from './chart-data';
import { uiBlockHead, uiEventTime, uiLiveChoiceReason, uiNodeLabel, uiNodeText, uiReasonText, uiUrlDomain, uiWithUnit } from './node-text';
import { UI_RENDERERS } from './registry';
import type { UiRenderContext, UiRenderer, UiRendererProps } from './render-context';
import { UiSourceCitation } from './renderers/content';
import { ChecklistRenderer } from './renderers/inputs';
import { uiTableCell, uiTableColumns, uiTableOrder, uiTableSort } from './table-data';
import { UiBlockFrame, type UiBlockFrameProps } from './UiBlockFrame';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

/* A component whose children go in as the children of `createElement`, as JSX would pass them. */
type Drawable<Props> = ComponentType<Omit<Props, 'children'>>;

const Frame = UiBlockFrame as Drawable<UiBlockFrameProps>;

const CONTEXT: UiRenderContext = { scopeId: 'scope', chatId: 'chat', itemId: 'item', blockId: 'block', phase: 'final', answer: null };

function compiled(source: string, final = true) {
    return compileUiBlock(source, { id: 'chat:item:block', final, limits: { milliseconds: 5000 } });
}

function evaluate(source: string, final = true): { nodes: UiViewNode[]; state: UiState } {
    const block = compiled(source, final);
    const state = new UiState(block);

    return { nodes: evaluateUiBlock(block, state, { milliseconds: 5000 }).nodes, state };
}

/* The smallest tree a runtime would draw, for these tests only: text as text, every other node through the registry. */
function drawn(nodes: readonly UiViewNode[], context: UiRenderContext): ReactNode {
    return nodes.map((node) => {
        if (node.type === '$text') {
            return createElement(Fragment, { key: node.id }, String(node.props.text));
        }

        const renderer = UI_RENDERERS[node.type as UiComponentName] as UiRenderer<unknown> | null;

        if (renderer === null) {
            return null;
        }

        return createElement(renderer as Drawable<UiRendererProps<unknown>>, { key: node.id, node, context }, drawn(node.children, context));
    });
}

let host: Partial<ChatHost> = {};

function markup(source: string, context: Partial<UiRenderContext> = {}, final = true): string {
    const full = { ...CONTEXT, ...context };
    const { nodes } = evaluate(source, final);

    return renderToStaticMarkup(createElement(ChatHostProvider, { host }, createElement(Frame, { nodes, phase: full.phase }, drawn(nodes, full))));
}

const REVIEW =
    '$selected = ["links", "preload"]\n<Summary tone="danger" badge="2 blocking">2 of 2 findings selected</Summary>' +
    '<Checklist value={$selected}><Item value="links"><File path="src/links.ts" line="148">Cuts a path</File></Item><Item value="preload">Bridge</Item></Checklist>' +
    '<Choices><Choice context={"Fix these findings: " + @Join($selected, ", ")} primary={true}>Fix {@Count($selected)}</Choice><Choice>Leave it</Choice></Choices>';

describe('the registry of intelligent UI renderers', () => {
    test('accounts for every catalog name, and only those', () => {
        expect(Object.keys(UI_RENDERERS).sort()).toEqual(Object.keys(UI_CATALOG).sort());
        expect(Object.keys(UI_RENDERERS)).toHaveLength(63);

        const empty = Object.entries(UI_RENDERERS)
            .filter(([, renderer]) => renderer === null)
            .map(([name]) => name)
            .sort();

        expect(empty).toEqual(['Column', 'Each', 'Option', 'Part', 'Place', 'Show']);
    });
});

describe('node text', () => {
    test('joins the text below a node and reads the head of a block', () => {
        const { nodes } = evaluate('$n = 3\n<Summary>Found {$n}   open <Tag>new</Tag> issues</Summary><Summary>Second</Summary>');
        expect(uiNodeText(nodes[0]!)).toContain('Found 3');
        expect(uiNodeLabel(nodes[0]!)).toBe('Found 3 open new issues');
        expect(uiBlockHead(nodes)).toEqual({ id: nodes[0]!.id, label: 'Found 3 open new issues' });
        expect(uiBlockHead(nodes.slice(1, 1))).toBeNull();
    });

    test('names a block by the words of its Summary, without the marks of its Markdown', () => {
        const { nodes } = evaluate('<Summary>Release `0.14.0` is **halfway**, see [notes](https://example.com)</Summary>');
        expect(uiBlockHead(nodes)?.label).toBe('Release 0.14.0 is halfway, see notes');
    });
});

describe('the frame of a block', () => {
    test('names the block by its Summary, gives only the head an icon, and says nothing in an empty footer', () => {
        const html = markup('<Summary tone="danger">Head</Summary><Summary tone="success">Sub</Summary>');
        expect(html).toContain('role="group" aria-label="Head"');
        expect(html).toContain('lucide-octagon-alert');
        expect(html).not.toContain('lucide-circle-check');
        expect(html).not.toContain('border-t');
        expect(html).not.toContain('aria-busy');
    });

    test('holds a skeleton while the fence has no node yet, and is busy while it streams', () => {
        const html = renderToStaticMarkup(createElement(Frame, { nodes: [], phase: 'streaming' }));
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('animate-pulse');
        expect(html).toContain('aria-label="Interactive block"');
    });

    test('writes the footer in its order', () => {
        const html = renderToStaticMarkup(
            createElement(Frame, {
                nodes: [],
                phase: 'final',
                live: { state: 'fresh', sources: ['launch.status'], readAt: null },
                answered: { label: 'Fix 2', at: Date.UTC(2026, 9, 9, 12, 7) },
                fixes: [
                    { code: 'unknown_prop', message: 'Stat: dropped tone="huge"' },
                    { code: 'refused_prop', message: 'Image: dropped url' }
                ],
                shownAsText: 'The block is too large to draw'
            })
        );

        const order = ['Live', 'Not read', 'Fix 2', '2 notes', 'Shown as text', 'The block is too large to draw'];
        expect(order.map((words) => html.indexOf(words))).toEqual([...order.map((words) => html.indexOf(words))].sort((a, b) => a - b));
        expect(order.every((words) => html.includes(words))).toBe(true);
        expect(html).toContain('unknown_prop');
        expect(html).toContain('aria-expanded="false"');
    });
});

test('a known reason code is worded here, and an unknown one reads as the reason the machine gave', () => {
    const t = i18next.getFixedT('en', 'agent-chat');
    expect(uiReasonText(t, 'refresh-limit', 'This query may refresh once every ten seconds.')).toBe('This source reads at most once every ten seconds.');
    expect(uiReasonText(t, 'outside-project', 'This file is outside the project.')).toBe("Outside the agent's project.");
    expect(uiReasonText(t, 'newer-code', 'A reason from a newer machine.')).toBe('A reason from a newer machine.');
    expect(uiReasonText(t, undefined, 'Plain')).toBe('Plain');
});

test('a unit stands apart from its number everywhere, except a percent sign', () => {
    expect([uiWithUnit('5', 'ms'), uiWithUnit('5', '%'), uiWithUnit('5', undefined)]).toEqual(['5\u00a0ms', '5%', '5']);
    const html = markup('$wait = 5\n<Slider value={$wait} min={1} max={10} unit="ms">Wait</Slider>');
    expect(html).toContain('>5\u00a0ms</span>');
    expect(html).toContain('aria-valuetext="5\u00a0ms"');
});

test('closed choices of a live block say whether data is still read or why a reading failed', () => {
    const t = i18next.getFixedT('en', 'agent-chat');
    const sources = ['status'];
    expect(uiLiveChoiceReason(t, { state: 'fresh', sources, readAt: 1 })).toBeNull();
    expect(uiLiveChoiceReason(t, { state: 'reading', sources, readAt: null })).toBe('Available once the live data is read');

    expect(uiLiveChoiceReason(t, { state: 'refused', sources, readAt: null, code: 'access-unavailable', reason: 'x' })).toBe(
        'The chat that made this no longer has access.'
    );

    expect(uiLiveChoiceReason(t, { state: 'failed', sources, readAt: null, source: 'status' })).toBe('Could not read status');
});

test('a checklist, a list of sources and a table each have a name', () => {
    expect(markup('$picked = []\n<Checklist value={$picked}><Item value="a">A</Item></Checklist>')).toContain('role="group" aria-label="Checklist"');
    const sources = markup('<Sources><Source title="Docs" url="https://www.adecore.dev/guide"/></Sources>');
    const heading = /<span id="([^"]+)"[^>]*>Sources<\/span>/.exec(sources)?.[1];
    expect(heading).toBeDefined();
    expect(sources).toContain(`aria-labelledby="${heading}"`);
    expect(sources).not.toContain('aria-label="Sources"');
    expect(markup('<Table rows={[{name: "Core", size: 3}]}/>')).toContain('aria-label="Table of name, size"');
    expect(uiUrlDomain('https://www.adecore.dev/guide')).toBe('adecore.dev');
});

test('a source that cites a host node reads as the host names it, and opens only as a chip', () => {
    const source = '<Sources><Source title="Re: Q1 roadmap" node="mail:roadmap"/></Sources>';
    const chip = markup(source, {
        link: (target) =>
            target.type === 'Node' && target.id === 'mail:roadmap'
                ? { state: 'chip', label: 'Re: Q1 roadmap planning', detail: 'Jan Dekker, Tue' }
                : { state: 'plain' },
        openLink: () => undefined
    });

    expect(chip).toContain('Re: Q1 roadmap planning');
    expect(chip).toContain('Jan Dekker, Tue');
    expect(chip).toMatch(/<button type="button"[^>]*>.*Re: Q1 roadmap planning/);

    const plain = markup(source, { link: () => ({ state: 'plain' }), openLink: () => undefined });
    expect(plain).toContain('Re: Q1 roadmap');
    expect(plain).not.toMatch(/<button type="button"[^>]*>.*Re: Q1 roadmap/);
});

test('page memory forgets the value used longest ago past its limit', () => {
    const memory = new UiPageMemory<number>(2);
    memory.set('a', 1);
    memory.set('b', 2);
    expect(memory.get('a')).toBe(1);
    memory.set('c', 3);
    expect([memory.has('a'), memory.has('b'), memory.has('c'), memory.size]).toEqual([true, false, true, 2]);
});

describe('choices', () => {
    test('show their context below the label and stay closed while the reply streams', () => {
        const html = markup(REVIEW, { phase: 'streaming', onChoose: () => undefined });
        expect(html).toContain('Fix these findings: links, preload');
        expect(html).toMatch(/aria-disabled="true" aria-describedby="[^"]+"/);
        expect(html).toContain('opacity-60');
    });

    test('open once the block is done and a host can send them', () => {
        const open = markup(REVIEW, { onChoose: () => undefined });
        expect(open).not.toContain('aria-disabled');
        expect(markup(REVIEW)).toContain('aria-disabled="true"');
    });

    test('mark the chosen row and close the others', () => {
        const { nodes } = evaluate(REVIEW);
        const choiceId = nodes.find((node) => node.type === 'Choices')!.children.find((node) => node.type === 'Choice')!.id;
        const sent = markup(REVIEW, { onChoose: () => undefined, answer: { choiceId, state: 'sent' } });
        expect(sent).toContain('Sent');
        expect(sent).toContain('ring-accent');
        expect(sent).toContain('opacity-50');
        expect(markup(REVIEW, { onChoose: () => undefined, answer: { choiceId, state: 'queued' } })).toContain('Queued');
        const failed = markup(REVIEW, { onChoose: () => undefined, failedChoiceId: choiceId });
        expect(failed).toContain('role="alert"');
        expect(failed).toContain('Could not send. Try again.');
    });
});

describe('long text', () => {
    test('a long step detail and a long badge take a line of their own instead of squeezing the title', () => {
        const long = 'Missing information and decisions before work go through the built-in question tool.';
        const step = markup(`<Steps><Step state="pending" detail="${long}">Give the question tool priority</Step></Steps>`);
        expect(step).toContain('flex-wrap');
        expect(step).toContain(long);
        const summary = markup(`<Summary badge="${long}">Result of the research</Summary>`);
        expect(summary).toContain(`<p class="text-2xs font-medium wrap-anywhere text-text-muted">${long}</p>`);
        expect(summary).not.toContain('whitespace-nowrap');
    });

    test('a short badge of a summary is a tag in its tone at the end of the row, and its detail a muted line under the title', () => {
        const html = markup('<Summary tone="success" badge="v2.4.0" detail="Published 4 minutes ago">The release is live</Summary>');
        expect(html).toMatch(/<\/div><span class="[^"]*whitespace-nowrap[^"]*bg-status-idle\/15 text-status-idle[^"]*">v2\.4\.0<\/span><\/div>/);
        // On the surface of a tone the detail is the full text color, which muted text does not read on.
        expect(html).toContain('<p class="text-xs wrap-break-word text-text">Published 4 minutes ago</p>');
        expect(markup('<Summary detail="Since Monday">Release overview</Summary>')).toContain(
            '<p class="text-xs wrap-break-word text-text-muted">Since Monday</p>'
        );
        expect(markup('<Summary badge="Draft">Release overview</Summary>')).toMatch(/bg-text\/7 text-text-muted[^"]*">Draft<\/span>/);
    });
});

describe('a choice the host would refuse', () => {
    test('is drawn as its text with no row to press, once the reply is done', () => {
        for (const source of [
            '<Choices><Choice context="Run checks"></Choice></Choices>',
            '<Choices><Choice context="Run checks">Run checks',
            '<Choices><Choice context="Run checks">Run {$missing}</Choice></Choices>'
        ]) {
            const html = markup(source, { onChoose: () => undefined });
            expect(html).not.toContain('<button');
            expect(html).toContain('Could not show this part');
            expect(html).toContain('Run checks');
        }

        expect(markup('<Choices><Choice context="Run checks">Run checks</Choice></Choices>', { onChoose: () => undefined })).toContain('<button');
    });
});

describe('local inputs', () => {
    test('change their state only through the binding, once their node closed', () => {
        const { nodes, state } = evaluate(REVIEW);
        const list = nodes.find((node) => node.type === 'Checklist') as UiViewNode<{ value: (string | number | boolean | null)[] }>;
        let element: ReactElement<{ value: { toggle(value: unknown): void } }> | null = null;

        // Called inside a render, since the compiled renderer keeps its memo in a hook.
        const Probe = (): null => {
            element = ChecklistRenderer({ node: list, children: null, context: CONTEXT }) as ReactElement<{ value: { toggle(value: unknown): void } }>;

            return null;
        };

        renderToStaticMarkup(createElement(Probe));
        element!.props.value.toggle('links');
        expect(state.scope().$selected).toEqual(['preload']);
    });

    test('are disabled without a binding or before their node closed', () => {
        const readOnly = { ...evaluate('<Switch value={true}>Show nits</Switch>').nodes[0]!, bindings: {} };

        const html = renderToStaticMarkup(
            createElement(UI_RENDERERS.Switch! as Drawable<UiRendererProps<{ value: boolean }>>, { node: readOnly as never, context: CONTEXT }, 'Show nits')
        );

        expect(html).toContain('data-disabled');
        const partial = markup('$count = 4\n<Slider value={$count} min={1} max={16}>Agents', {}, false);
        expect(partial).toContain('pointer-events-none opacity-60');
    });

    test('a segmented control with a sentence for a label stands in a column', () => {
        const long = 'Missing information and decisions before work go through the question tool';

        expect(markup(`$mode = "a"\n<Segmented value={$mode}><Option value="a">${long}</Option><Option value="b">Other</Option></Segmented>`)).toContain(
            'aria-orientation="vertical"'
        );

        expect(markup('$mode = "a"\n<Segmented value={$mode}><Option value="a">One</Option><Option value="b">Two</Option></Segmented>')).not.toContain(
            'aria-orientation'
        );
    });

    test('a text field is a labeled input that stops at its limit and counts only when it nears it', () => {
        const field = (value: string, extra = '') => `$q = "${value}"\n<TextField value={$q} maxLength={10} placeholder="Name"${extra}>Who</TextField>`;

        const html = markup(field('Ada'));
        expect(html).toMatch(/<label for="[^"]+" class="px-0.5 text-2xs text-text-muted">Who<\/label>/);
        expect(html).toContain('maxLength="10"');
        expect(html).toContain('placeholder="Name"');
        expect(html).toContain('value="Ada"');
        expect(html).not.toContain('characters');
        expect(markup(field('Ada Lovela'))).toContain('10 of 10 characters');
        expect(markup(field('Ada Love'))).toContain('8 of 10 characters');
        expect(markup('$q = ""\n<TextField value={$q}>Who</TextField>')).toContain('maxLength="256"');
        expect(markup(field('Ada'), { answer: { choiceId: 'other', state: 'sent' } })).toContain('disabled');
        expect(markup('$q = "Ada"\n<TextField value={$q}>Who', {}, false)).toContain('opacity-60');
    });

    test('a multiline text field is a textarea with the same label, limit and count', () => {
        const html = markup('$note = "Line one"\n<TextField value={$note} maxLength={10} placeholder="Why" multiline>Note</TextField>');
        expect(html).toMatch(/<label for="([^"]+)" class="px-0.5 text-2xs text-text-muted">Note<\/label><textarea id="\1"/);
        expect(html).toContain('maxLength="10"');
        expect(html).toContain('placeholder="Why"');
        expect(html).toContain('>Line one</textarea>');
        expect(html).toContain('8 of 10 characters');
        expect(html).not.toContain('<input');
        expect(markup('$note = ""\n<TextField value={$note} multiline={false}>Note</TextField>')).toContain('<input');
    });

    test('a segmented control stands under its label and is named by it', () => {
        const source = (label: string) =>
            `$env = "dev"\n<Segmented value={$env}${label}><Option value="dev">Dev</Option><Option value="prod">Prod</Option></Segmented>`;
        const html = markup(source(' label="Environment"'));
        expect(html).toContain('<span class="px-0.5 text-2xs text-text-muted">Environment</span>');
        expect(html).toContain('aria-label="Environment"');
        expect(markup(source(''))).toContain('aria-label="Options"');
        expect(markup(source(''))).not.toContain('px-0.5 text-2xs');
    });

    test('a select shows the label of the chosen option, stays a trigger, and closes without a binding or an option', () => {
        const source = '$kind = "idea"\n<Select value={$kind}><Option value="bug">Bug</Option><Option value="idea">Idea</Option></Select>';
        const html = markup(source);
        expect(html).toContain('aria-label="Options"');
        expect(html).toContain('Idea');
        expect(html).not.toContain('data-disabled=""');
        expect(markup(source, { answer: { choiceId: 'other', state: 'sent' } })).toContain('data-disabled=""');
        const readOnly = { ...evaluate('<Select value="bug"><Option value="bug">Bug</Option></Select>').nodes[0]!, bindings: {} };

        expect(renderToStaticMarkup(createElement(UI_RENDERERS.Select as Drawable<UiRendererProps<unknown>>, { node: readOnly, context: CONTEXT }))).toContain(
            'data-disabled=""'
        );
    });

    test('a button closes once the block is answered', () => {
        const html = markup('$mode = "all"\n<Button action={@Reset()}>Reset</Button>', { answer: { choiceId: 'other', state: 'sent' } });
        expect(html).toContain('Reset');
        expect(html).toContain('disabled');
    });

    test('label a slider and a segmented control with their text', () => {
        const html = markup(
            '$count = 8\n$mode = "all"\n<Slider value={$count} min={1} max={16}>Parallel agents</Slider><Segmented value={$mode}><Option value="all">All</Option><Option value="failed">Failing</Option></Segmented>'
        );

        expect(html).toContain('Parallel agents');
        expect(html).toContain('aria-checked="true"');
        expect(html).toContain('Failing');
    });
});

describe('text and status', () => {
    test('progress reads its value against its max, or as a percentage', () => {
        expect(markup('<Progress value={312} max={500}>Indexing files</Progress>')).toContain('312 of 500');
        expect(markup('<Progress value={46}>Share</Progress>')).toContain('46%');
    });

    test('progress wears its tone on the reading, with the icon and the word of the tone, and a detail under the bar', () => {
        const html = markup('<Progress value={7} max={12} tone="warning" detail="Two files need a hand">Files migrated</Progress>');
        expect(html).toContain('<span class="text-status-needs-you">7 of 12</span>');
        expect(html).toContain('lucide-triangle-alert');
        expect(html).toContain('aria-valuetext="7 of 12, Warning"');
        expect(html).toContain('<p class="text-2xs wrap-anywhere text-text-muted">Two files need a hand</p>');
        const quiet = markup('<Progress value={46}>Share</Progress>');
        expect(quiet).toContain('<span class="text-text-muted">46%</span>');
        expect(quiet).toContain('aria-valuetext="46%"');
        expect(quiet).not.toContain('lucide-');
    });

    test('steps stand in one tile on a rail, and only a failed step says its state in sight', () => {
        const html = markup('<Steps><Step state="done" detail="4 min">Unit tests</Step><Step state="failed">Integration</Step><Step>Release</Step></Steps>');
        expect(html.match(/bg-ui-tile/g)).toHaveLength(1);
        expect(html).toContain('<ol class="chat-ui-nodes chat-ui-flat flex flex-col rounded-xl bg-ui-tile p-3">');
        expect(html.match(/<li /g)).toHaveLength(3);
        expect(html.match(/w-px grow bg-border group-last:hidden/g)).toHaveLength(3);
        expect(html).toContain('<span class="text-2xs text-status-error">Failed</span>');
        expect(html).toContain('<span class="sr-only">Done</span>');
        expect(html).toContain('<span class="sr-only">Waiting</span>');
        expect(html).toContain('text-2xs wrap-anywhere text-text-muted tabular-nums">4 min</span>');
        expect(html).not.toContain('whitespace-nowrap');
    });

    test('a running step spins only while the block is live', () => {
        const source = '<Steps><Step state="running">Build</Step><Step state="done" detail="42 s">Lint</Step></Steps>';
        expect(markup(source)).toContain('lucide-circle-dot');
        expect(markup(source, { phase: 'streaming' }, false)).not.toContain('lucide-circle-dot');
        expect(markup(source)).toContain('42 s');
    });

    test('a timeline writes each time the way the region writes it, and reads a time without an offset as written', () => {
        setSystemTime(new Date(2026, 9, 14, 12));

        const source =
            '<Timeline><Event at="14:02" tone="warning" detail="p95 above 2 s">Alert fired</Event>' +
            '<Event at="2026-10-14" tone="info">Rolled back</Event>' +
            '<Event at="2026-10-14T14:14:00">Recovered</Event>' +
            '<Event at="2026-10-14T14:20:00+02:00" tone="success">Checked</Event></Timeline>';

        const html = markup(source);
        expect(html).toContain('<ol class="chat-ui-nodes');
        expect(html).toContain('<time dateTime="14:02"');
        expect(html).toContain('p95 above 2 s');
        expect(html).toContain('aria-label="02:02 PM, Alert fired, Warning, p95 above 2 s"');
        expect(html).toContain('aria-label="Oct 14, Rolled back, Info"'.replace('Oct 14', formatDay(new Date(2026, 9, 14))));
        expect(html).toContain('aria-label="' + formatDayClock(new Date(2026, 9, 14, 14, 14)) + ', Recovered"');
        expect(html).toContain(`>${formatDay(new Date(2026, 9, 14))}</time>`);
        expect(html).toContain(`>${formatDayClock(new Date(2026, 9, 14, 14, 14))}</time>`);
        expect(html).toContain(`>${formatDayClock(new Date(Date.UTC(2026, 9, 14, 12, 20)))}</time>`);
        expect(html).toContain('text-status-needs-you');
        const previous = setFormatSource(Object.assign(fakeFormatSource(), { region: () => 'nl-NL' }) as FormatSource);

        try {
            expect(uiEventTime('14:02')).toBe('14:02');
            expect(uiEventTime('14:02')).toBe(formatClock(new Date(2000, 0, 1, 14, 2)));
        } finally {
            setFormatSource(previous);
        }
    });

    test('a time that wrote seconds keeps them, and one that did not stays to the minute', () => {
        const previous = setFormatSource(Object.assign(fakeFormatSource(), { region: () => 'nl-NL' }) as FormatSource);

        try {
            expect(uiEventTime('15:41:55')).toBe('15:41:55');
            expect(uiEventTime('15:41:55.250')).toBe('15:41:55');
            expect(uiEventTime('15:41')).toBe('15:41');
        } finally {
            setFormatSource(previous);
        }

        const html = markup('<Timeline><Event at="15:41:55" tone="info">Deployed</Event></Timeline>');
        expect(html).toContain('<time dateTime="15:41:55"');
        expect(html).not.toContain('Could not show this part');
    });

    test('an event writes the year once it is not this one, and a time inside a clock change as written', () => {
        setSystemTime(new Date(2026, 9, 14, 12));
        expect(uiEventTime('2026-03-02')).toBe(formatDay(new Date(2026, 2, 2)));
        expect(uiEventTime('2025-03-02')).toBe(formatDayWithYear(new Date(2025, 2, 2)));
        expect(uiEventTime('2025-03-02T09:30')).toBe(formatDayClockWithYear(new Date(2025, 2, 2, 9, 30)));
        expect(uiEventTime('2027-06-01T12:00:00Z')).toBe(formatDayClockWithYear(new Date(Date.UTC(2027, 5, 1, 12))));
        expect(uiEventTime('14:02', new Date(2031, 0, 1))).toBe(formatClock(new Date(2000, 0, 1, 14, 2)));
        const zone = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        process.env.TZ = 'Europe/Amsterdam';

        try {
            expect(uiEventTime('2026-03-29T02:30')).toBe(formatDayClock(new Date(Date.UTC(2026, 2, 29, 2, 30)), 'UTC'));
            expect(uiEventTime('2026-03-29T02:30')).toContain('02:30');
        } finally {
            process.env.TZ = zone;
        }
    });

    test('an event row leaves a neutral tone out of what it says', () => {
        const html = markup('<Timeline><Event at="14:02">Plain</Event><Event at="14:03" tone="danger" detail="Down">Alert</Event></Timeline>');
        expect(html).toContain('aria-label="02:02 PM, Plain"');
        expect(html).toContain('aria-label="02:03 PM, Alert, Danger, Down"');
    });

    test('a stat says how it changed without coloring it unless it has a tone', () => {
        const html = markup('<Stats><Stat label="Cold start" value={1.42} previous={1.9} unit="s"/></Stats>');
        expect(html).toContain('25% from 1.9 s');
        expect(html).toContain('tabular-nums text-text-muted');
        expect(html).toContain('<span aria-hidden="true">-25%</span>');
        expect(html).toContain('lucide-arrow-down');
        // A change from zero has no percentage, so it shows what it came from.
        const fromZero = markup('<Stats><Stat label="Tests" value={3} previous={0} tone="danger"/></Stats>');
        expect(fromZero).toContain('tabular-nums text-status-error');
        expect(fromZero).toContain('<span aria-hidden="true">0</span>');
        expect(markup('<Stats><Stat label="Tests" value={6777} previous={6412}/></Stats>')).toContain('<span aria-hidden="true">+5.7%</span>');
    });

    test('a stat sets its unit apart from the value, except a percent sign, and a value in words stands as written', () => {
        const html = markup('<Stats><Stat label="CI" value={21.6} unit="min"/><Stat label="Coverage" value={71} unit="%"/></Stats>');
        expect(html).toContain('tabular-nums">21.6</span><span class="max-w-1/2 shrink-0 truncate text-xs text-text-muted">min</span>');
        expect(html).toContain('tabular-nums">71%</span></div>');
        const words = markup('<Stats><Stat label="State" value="Ready" unit="min" previous={3}/></Stats>');
        expect(words).toContain('tabular-nums">Ready</span></div>');
        expect(words).not.toContain('lucide-arrow');
    });

    test('a stat draws its trend as a line in the color of its tone, named by its first and last value', () => {
        const html = markup('<Stats><Stat label="Latency" value={48} unit="ms" tone="success" trend={[60, 55, 48]}/></Stats>');
        expect(html).toContain('<svg role="img" aria-label="Trend from 60 ms to 48 ms" viewBox="0 0 100 24"');
        expect(html).toContain('class="h-6 w-full text-positive"');
        expect(html).toContain('d="M0,2 L50,10.33 L100,22"');
        // A course that never moves is a level line, not a division by nothing.
        expect(markup('<Stats><Stat label="Errors" value={0} trend={[0, 0]}/></Stats>')).toContain('d="M0,12 L100,12"');
        expect(markup('<Stats><Stat label="Errors" value={0}/></Stats>')).not.toContain('<svg role="img"');
    });

    test('a live stat lights up once it changed, stays dark when stale and keeps the comparison the agent wrote', () => {
        const source = '<Stats><Stat label="Changed files" value={4} previous={2}/></Stats>';
        const asked: [string, string][] = [];

        const changed = markup(source, {
            liveValue: (nodeId, prop) => {
                asked.push([nodeId, prop]);

                return { previous: 3, changed: true, stale: false };
            }
        });

        expect(asked.map(([, prop]) => prop)).toEqual(['value']);
        expect(changed).toMatch(/<span class="chat-ui-changed min-w-0 truncate text-lg font-semibold text-text tabular-nums">4<\/span>/);
        expect(changed).toContain('100% from 2');
        expect(markup(source, { liveValue: () => ({ previous: 4.001, changed: true, stale: false }) })).not.toContain('chat-ui-changed');
        // The node around a stale value dims it; the value itself keeps its color.
        const stale = markup(source, { liveValue: () => ({ changed: true, stale: true }) });
        expect(stale).not.toContain('text-text-muted min-w-0');
        expect(stale).not.toContain('chat-ui-changed');
        expect(markup(source)).not.toContain('chat-ui-changed');
    });
});

describe('tables', () => {
    test('take columns from their Column children and protect values of the wrong kind', () => {
        const { nodes } = evaluate(
            '<Table rows={[{name: "Core", size: 32}, {name: "Client", size: "n/a"}]}><Column key="name"/><Column key="size" as="number" unit="ms"/><Column key="missing"/></Table>'
        );

        const columns = uiTableColumns(nodes[0] as never);
        expect(columns.map((column) => column.key)).toEqual(['name', 'size']);
        expect(uiTableCell('n/a', columns[1]!)).toEqual({ kind: 'text', text: 'n/a' });
        expect(uiTableCell(undefined, columns[1]!)).toEqual({ kind: 'empty' });
        expect(uiTableCell('12', columns[1]!)).toEqual({ kind: 'number', as: 'number', value: 12 });
    });

    test('a date beyond what a Date can hold is text, and the rest of the table still draws', () => {
        const column = { key: 'at', title: 'at', as: 'date' as const };

        for (const value of [1e20, 8.64e15 + 1, -8.64e15 - 1]) {
            expect(uiTableCell(value, column).kind).toBe('text');
        }

        expect(uiTableCell(8.64e15, column)).toEqual({ kind: 'date', at: 8.64e15 });
        expect(uiTableCell('2026-10-11T08:00:00Z', column)).toEqual({ kind: 'date', at: Date.parse('2026-10-11T08:00:00Z') });
        const html = markup('<Table rows={[{at: 1e20, name: "Far"}, {at: 0, name: "Epoch"}]}><Column key="at" as="date"/><Column key="name"/></Table>');
        expect(html).toContain('<table');
        expect(html).toContain('Epoch');
        expect(html).not.toContain('Could not show this part');
    });

    test('a table without columns shows every key of its rows', () => {
        const { nodes } = evaluate('<Table rows={[{a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9}]}/>');
        expect(uiTableColumns(nodes[0] as never).map((column) => column.key)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    });

    test('show fifty rows until a person asks for all of them', () => {
        const rows = Array.from({ length: 60 }, (_, index) => `{n: ${index}}`).join(', ');
        const html = markup(`<Table rows={[${rows}]}/>`);
        expect(html.match(/<tr/g)).toHaveLength(51);
        expect(html).toContain('Show all 60 rows');
    });

    test('ask for the live state of every cell by row and key, and light any kind that changed', () => {
        const asked: unknown[] = [];

        const html = markup(
            '<Table rows={[{name: "Core", size: 32}, {name: "Client", size: 40, state: "red"}]}><Column key="name"/><Column key="size" as="number"/><Column key="state" as="tag"/></Table>',
            {
                liveValue: (_nodeId, prop, path) => {
                    asked.push([prop, path]);

                    if (path?.[0] === 1 && path[1] === 'size') {
                        return { previous: 38, changed: true, stale: false };
                    }

                    return path?.[0] === 1 && path[1] === 'state' ? { previous: 'green', changed: true, stale: false } : { changed: false, stale: false };
                }
            }
        );

        expect(asked).toEqual([
            ['rows', [0, 'name']],
            ['rows', [0, 'size']],
            ['rows', [0, 'state']],
            ['rows', [1, 'name']],
            ['rows', [1, 'size']],
            ['rows', [1, 'state']]
        ]);

        expect(html).toContain('<span>32</span>');
        expect(html).toContain('<span class="chat-ui-changed">40</span>');
        expect(html).toMatch(/<span class="chat-ui-changed"><span[^>]*>red<\/span><\/span>/);
        expect(html).toContain('<span>Core</span>');
    });

    test('draw their text when no column is usable', () => {
        expect(markup('<Table rows={[{a: 1}]}><Column key="b"/></Table>')).toContain('Could not show this part');
    });

    test('a file cell is its path as text, never a link nobody checked', () => {
        const html = markup('<Table rows={[{path: "src/a.ts"}]}><Column key="path" as="file"/></Table>', { link: () => ({ state: 'plain' }) });
        expect(html).toContain('<span class="font-mono text-code break-all">src/a.ts</span>');
        expect(html).not.toContain('tabindex');
    });

    test('a tag cell wears the tone its column gives its text, and stays quiet for a text the column does not name', () => {
        const html = markup(
            '<Table rows={[{state: "passed"}, {state: "failed"}, {state: "constructor"}]}><Column key="state" as="tag" tones={{"passed": "success", "failed": "danger"}}/></Table>'
        );

        expect(html).toMatch(/bg-status-idle\/15 text-status-idle">passed<\/span>/);
        expect(html).toMatch(/bg-status-error\/15 text-status-error">failed<\/span>/);
        expect(html).toMatch(/bg-text\/7 text-text-muted">constructor<\/span>/);
    });

    test('order a column by value or by the language, with empty cells last and each row at its own place', () => {
        const rows = [{ ms: 900, name: 'b' }, { ms: '1200', name: 'A' }, { name: 'c' }, { ms: 30, name: 'a10' }, { ms: 'n/a', name: 'a9' }];
        const duration = { key: 'ms', title: 'ms', as: 'duration' as const };
        const name = { key: 'name', title: 'name', as: 'text' as const };

        expect(uiTableOrder(rows, duration, false)).toEqual([3, 0, 1, 4, 2]);
        expect(uiTableOrder(rows, duration, true)).toEqual([1, 0, 3, 4, 2]);
        expect(uiTableOrder(rows, name, false)).toEqual([1, 4, 3, 0, 2]);
        expect(uiTableOrder([{ at: '2026-10-11' }, { at: 0 }], { key: 'at', title: 'at', as: 'date' }, false)).toEqual([1, 0]);
        // Equal values keep the order they arrived in, in both directions.
        expect(uiTableOrder([{ n: 1 }, { n: 1 }], { key: 'n', title: 'n', as: 'number' }, true)).toEqual([0, 1]);
    });

    test('read the order a table asks for, and none for a key it draws no column of', () => {
        const columns = [
            { key: 'size', title: 'Size', as: 'bytes' as const },
            { key: 'last desc', title: 'Last', as: 'text' as const }
        ];

        expect(uiTableSort('size', columns)).toEqual({ key: 'size', descending: false });
        expect(uiTableSort(' size  DESC ', columns)).toEqual({ key: 'size', descending: true });
        expect(uiTableSort('size asc', columns)).toEqual({ key: 'size', descending: false });
        expect(uiTableSort('last desc', columns)).toEqual({ key: 'last desc', descending: false });
        expect(uiTableSort('missing desc', columns)).toBeNull();
        expect(uiTableSort(undefined, columns)).toBeNull();
    });

    test('arrive in the order of sort, say so on the head, and still ask live readings by the place of a row in rows', () => {
        const asked: unknown[] = [];

        const html = markup(
            '<Table sort="size desc" rows={[{name: "Core", size: 32}, {name: "Client", size: 40}]}><Column key="name"/><Column key="size" as="number"/></Table>',
            { liveValue: (_nodeId, _prop, path) => void asked.push(path) as undefined }
        );

        expect(html.indexOf('Client')).toBeLessThan(html.indexOf('Core'));
        expect(html).toMatch(/<th scope="col" aria-sort="descending"[^>]*><button type="button"[^>]*>size<svg[^>]*lucide-arrow-down/);
        expect(html.match(/aria-sort/g)).toHaveLength(1);
        expect(asked).toEqual([
            [1, 'name'],
            [1, 'size'],
            [0, 'name'],
            [0, 'size']
        ]);

        const unsorted = markup('<Table rows={[{name: "Core"}, {name: "Client"}]}/>');
        expect(unsorted).not.toContain('aria-sort');
        expect(unsorted).toMatch(/<th scope="col"[^>]*><button type="button"[^>]*>name<\/button>/);
    });
});

describe('entity lists', () => {
    test('are tiles up to four entries and a list from five, unless layout says which', () => {
        const entries = (count: number) => Array.from({ length: count }, (_, index) => `<Entry label="k${index}">v${index}</Entry>`).join('');

        expect(markup(`<EntityList>${entries(4)}</EntityList>`)).not.toContain('<dl');
        expect(markup(`<EntityList>${entries(5)}</EntityList>`)).toContain('<dl');
        expect(markup(`<EntityList layout="list">${entries(2)}</EntityList>`)).toContain('<dl');
        expect(markup(`<EntityList layout="tiles">${entries(6)}</EntityList>`)).not.toContain('<dl');
    });

    test('an entry formats its value as a table cell of its kind, and shows one that does not parse as written', () => {
        const html = markup(
            '<EntityList><Entry label="Took" as="duration">262000</Entry><Entry label="Size" as="bytes">2048</Entry><Entry label="State" as="tag">passed</Entry><Entry label="Share" as="percent">n/a</Entry></EntityList>'
        );

        expect(html).toContain('>4 min<');
        expect(html).toContain('>2 KB<');
        expect(html).toMatch(/bg-text\/7 text-text-muted">passed<\/span>/);
        expect(html).toContain('>n/a<');
        expect(markup('<EntityList><Entry label="At" as="date">0</Entry></EntityList>')).toContain('<time dateTime="1970-01-01T00:00:00.000Z">');
    });
});

describe('charts', () => {
    test('keep up to six numeric series and leave gaps for values that are no number', () => {
        const data: Record<string, string | number | boolean | null>[] = [
            { label: 'Mon', a: 1, b: 'x', c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 },
            { label: 'Tue', a: null, c: 1 }
        ];

        const chart = uiChartData(data, 'bar')!;
        expect(chart.series.map((series) => series.key)).toEqual(['a', 'c', 'd', 'e', 'f', 'g']);
        expect(chart.series).toHaveLength(UI_CHART_SERIES);
        expect(chart.series[0]!.values).toEqual([1, null]);
        expect(uiChartData([{ label: 'x', value: 'none' }], 'bar')).toBeNull();

        expect(
            uiChartData(
                [
                    { label: 'x', a: 2 },
                    { label: 'y', a: 3, b: 4 }
                ],
                'stacked'
            )!.max
        ).toBe(7);

        expect([niceCeiling(41), niceCeiling(0.9), niceCeiling(212)]).toEqual([50, 1, 250]);
    });

    test('draw only once their node closed, and describe themselves', () => {
        const source = '<Chart kind="bar" data={[{label: "Core", passed: 32, failed: 1}]}/>';
        const partial = markup(source.slice(0, -2), { phase: 'streaming' }, false);
        expect(partial).not.toContain('role="img"');
        const html = markup(source);
        expect(html).toContain('role="img"');
        expect(html).toContain('highest passed for Core at 32');
        expect(html).toContain('<caption>Values</caption>');
        expect(markup('<Chart kind="line" data={[{label: "x", value: "none"}]}/>')).toContain('Could not show this part');
    });

    test('a horizontal chart draws a negative value from zero to the left', () => {
        const html = markup('<Chart kind="hbar" data={[{label: "Balance", income: 10, cost: -6}]}/>');
        expect(html).not.toContain('NaN');
        expect(html).toContain('left:50%;width:50%');
        expect(html).toContain('left:20%;width:30%');
        const negative = markup('<Chart kind="hbar" data={[{label: "Core", value: -3}, {label: "Client", value: -1}]}/>');
        expect(negative).not.toContain('NaN');
        expect(negative).toContain('left:40%;width:60%');
        expect(negative).toContain('-3');
    });

    test('stacked data with a negative value stands side by side and says why', () => {
        const chart = uiChartData([{ label: 'Balance', income: 10, cost: -6 }], 'stacked')!;
        expect([chart.kind, chart.min, chart.max]).toEqual(['bar', -6, 10]);

        expect(markup('<Chart kind="stacked" data={[{label: "Balance", income: 10, cost: -6}]}/>')).toContain(
            'Negative values cannot stack. Series shown side by side.'
        );

        expect(uiChartData([{ label: 'Total', a: 2, b: 3 }], 'stacked')!.kind).toBe('stacked');
    });

    test('say which rows and series they leave out, and keep every value reachable', () => {
        const rows = Array.from({ length: 61 }, (_, index) => ({ label: `Row ${index}`, count: index === 60 ? 1_000_000 : 1 }));
        const chart = uiChartData(rows, 'hbar')!;
        expect([chart.labels.length, chart.total, chart.truncated]).toEqual([60, 61, true]);
        const html = markup(`<Chart kind="hbar" data={${JSON.stringify(rows)}}/>`);
        expect(html).toContain('Showing 60 of 61 rows.');
        expect(html).toContain('Show all values');
        expect(html).toContain('61 values, highest Row 60 at 1,000,000');
        expect(html).toContain('<th scope="row">Row 60</th>');
        const wide = '<Chart kind="stacked" data={[{label: "Total", a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7}]}/>';
        expect(uiChartData([{ label: 'Total', a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }], 'stacked')!.omitted).toEqual(['g']);
        const seven = markup(wide);
        expect(seven).toContain('g not shown.');
        expect(seven).toContain('<th scope="col">g</th>');
        expect(compiled(wide).diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['too_many_series']);
        expect(markup('<Chart kind="bar" data={[{label: "Core", count: 2}]}/>')).not.toContain('Show all values');
    });

    test('an axis is as wide as its longest label, and a label never runs past its room', () => {
        expect(uiChartAxis(['0', '1', '2'], 326).axisWidth).toBe(44);
        const wide = uiChartAxis(['0', '500,000', '1,000,000'], 326);
        expect(wide.axisWidth).toBe(uiChartTextWidth('1,000,000') + 8);
        const narrow = uiChartAxis(['0', '1,000,000,000,000,000,000,000'], 326);
        expect(narrow.axisWidth).toBeLessThanOrEqual(130);
        expect(uiChartTextWidth(narrow.tickTexts[1]!) + 8).toBeLessThanOrEqual(130);
        expect(uiChartText('Zeer lange categorie zonder een compacte naam', 120)).toBe('Zeer lange cate…');
        expect(uiChartText('Core', 120)).toBe('Core');
    });

    test('text that grows with the root font size gets as much more room', () => {
        expect(uiChartCharacter(16)).toBe(7.5);
        expect(uiChartCharacter(32)).toBe(15);
        expect(uiChartCharacter(Number.NaN)).toBe(7.5);
        const large = uiChartAxis(['0', '500,000', '1,000,000'], 326, uiChartCharacter(32));
        expect(large.axisWidth).toBeGreaterThan(88);
        expect(large.axisWidth).toBeLessThanOrEqual(Math.floor(326 * 0.4));

        for (const text of large.tickTexts) {
            expect(uiChartTextWidth(text, uiChartCharacter(32)) + 8).toBeLessThanOrEqual(large.axisWidth);
        }
    });

    test('values a screen reader hears never widen the block they sit in', () => {
        expect(markup('<Chart kind="bar" data={[{label: "Big", count: 9e307}]}/>')).toMatch(/<div class="sr-only"><table>/);
    });

    test('numbers too large to scale draw as text, never as a coordinate that is not a number', () => {
        for (const source of [
            '<Chart kind="bar" data={[{label: "Huge", count: 1.5e308}]}/>',
            '<Chart kind="stacked" data={[{label: "Huge", a: 1e308, b: 1e308}]}/>'
        ]) {
            const html = markup(source);
            expect(html).not.toMatch(/NaN|Infinity/);
            expect(html).toContain('Could not show this part');
        }

        expect(uiChartData([{ label: 'Wide', low: -9e307, high: 9e307 }], 'bar')).toBeNull();
        expect(uiChartRange(-3, 5)).toEqual({ low: -5, high: 5 });
        // A subnormal span would scale every coordinate by an infinite factor.
        expect(uiChartRange(0, Number.MIN_VALUE)).toBeNull();
        expect(uiChartRange(0, 1e-310)).toBeNull();
        expect(uiChartRange(0, 1e-300)).not.toBeNull();
        expect(uiChartData([{ label: 'Tiny', value: Number.MIN_VALUE }], 'bar')).toBeNull();
        const tiny = markup(`<Chart kind="hbar" data={[{label: "Tiny", value: ${Number.MIN_VALUE}}]}/>`);
        expect(tiny).not.toMatch(/NaN|Infinity/);
        expect(tiny).toContain('Could not show this part');
        const drawn = markup('<Chart kind="bar" data={[{label: "Big", count: 9e307}]}/>');
        expect(drawn).not.toMatch(/NaN|Infinity/);
        expect(drawn).toContain('role="img"');
    });
});

describe('links', () => {
    test('stay plain text without a host, and become chips the host opens', () => {
        const source = '<File path="src/terminal/links.ts" line="148"/>';
        expect(markup(source)).toContain('src/terminal/links.ts:148');
        expect(markup(source)).not.toContain('<button');
        const chip = markup(source, { link: () => ({ state: 'chip' }), openLink: () => undefined });
        expect(chip).toContain('<button');
        expect(chip).toContain('links.ts');
        const plain = markup('<File path="~/.codex/config.toml"/>', { link: () => ({ state: 'plain' }) });
        expect(plain).toContain('tabindex="0"');
        expect(markup('<Commit sha="47946f746"/>')).toContain('47946f7');
    });

    test('a node chip shows the state its host knows as a dot with the state in words, and nothing for a state it does not know', () => {
        const chip = (status?: string) =>
            markup('<Node id="node_1"/>', { link: () => ({ state: 'chip', label: 'Research', status }), openLink: () => undefined });

        expect(chip('running')).toContain(
            '<span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-status-running"></span><span class="sr-only">Running</span>'
        );
        expect(chip('needsYou')).toContain('bg-status-needs-you"></span><span class="sr-only">Needs you</span>');
        expect(chip('done')).toContain('bg-status-idle"></span><span class="sr-only">Done</span>');
        expect(chip('constructor')).not.toContain('rounded-full');
        expect(chip()).not.toContain('rounded-full');
        // A file never wears the state of a node.
        expect(markup('<File path="a.ts"/>', { link: () => ({ state: 'chip', status: 'running' }) })).not.toContain('rounded-full');
    });
});

describe('content', () => {
    afterEach(() => {
        host = {};
    });

    test('an image reads only an attachment of the chat', () => {
        expect(markup('<Image generated="latest" alt="A rabbit"/>')).not.toContain('<img');

        host = {
            attachments: { useUrl: (_scope, _chat, id) => ({ url: `blob:${id}`, failure: null }), read: () => Promise.reject(new Error('Not read here')) }
        };

        const html = markup('<Image attachment="rabbit" alt="A rabbit">The rabbit</Image>');
        expect(html).toContain('src="blob:rabbit"');
        expect(html).toContain('<figcaption');
    });

    test('a gallery draws each image as a square cell in a grid that narrows with its container, and a missing one says so', () => {
        host = {
            attachments: {
                useUrl: (_scope, _chat, id) => (id === 'gone' ? { url: null, failure: 'Gone' } : { url: `blob:${id}`, failure: null }),
                read: () => Promise.reject(new Error('Not read here'))
            }
        };

        const html = markup(
            '<Gallery><Image attachment="a1" alt="Login">First screen</Image><Image attachment="gone" alt="Home"/><Image generated="latest" alt="Never made"/></Gallery>'
        );

        expect(html).toContain('@container');
        expect(html).toContain('grid-cols-2');
        expect(html).toContain('@min-[420px]:grid-cols-3');
        expect(html).toContain('aria-label="3 images"');
        expect(html).toContain('src="blob:a1"');
        expect(html).toContain('aspect-ratio:1');
        expect(html).toContain('<figcaption class="px-0.5 text-2xs wrap-anywhere text-text-muted">First screen</figcaption>');
        expect(html).toContain('>Never made</figcaption>');
        expect(html).toContain('>Home</figcaption>');
        expect(markup('<Gallery><Image attachment="a1"/></Gallery>')).toContain('aria-label="1 image"');
    });

    test('a model is drawn by the host in a frame of fixed height, and stays a row without a view or its bytes', () => {
        const source = '<Model attachment="m1" alt="Bracket">The printed bracket</Model>';

        const urls: Record<string, { url: string | null; failure: string | null }> = {
            m1: { url: 'blob:m1', failure: null },
            gone: { url: null, failure: 'Gone' },
            waiting: { url: null, failure: null }
        };

        const attachments: ChatHost['attachments'] = { useUrl: (_scope, _chat, id) => urls[id]!, read: () => Promise.reject(new Error('Not read here')) };
        const seen: UiModelViewProps[] = [];

        const ModelView = (props: UiModelViewProps) => {
            seen.push(props);

            return createElement('canvas', { 'data-model': props.url });
        };

        host = { attachments };
        const row = markup(source);
        expect(row).not.toContain('<canvas');
        expect(row).toContain('>Bracket</span>');
        expect(row).toContain('>3D model</span>');
        expect(row).toContain('The printed bracket</figcaption>');
        host = { attachments, ModelView };
        const drawn = markup(source);
        expect(drawn).toContain('data-model="blob:m1"');
        expect(drawn).toContain('h-80');
        expect(drawn).toContain('aria-label="Bracket"');
        expect(drawn).toContain('The printed bracket</figcaption>');

        expect(seen.at(-1)).toEqual({
            scopeId: CONTEXT.scopeId,
            chatId: CONTEXT.chatId,
            attachmentId: 'm1',
            url: 'blob:m1',
            label: 'Bracket',
            alt: 'Bracket',
            caption: 'The printed bracket'
        });

        markup('<Model attachment="m1">The bracket</Model>');
        expect(seen.at(-1)).toMatchObject({ label: 'The bracket', alt: undefined, caption: 'The bracket' });
        const gone = markup('<Model attachment="gone"/>');
        expect(gone).not.toContain('<canvas');
        expect(gone).toContain('>gone</span>');
        expect(gone).toContain('Model unavailable');
        const waiting = markup('<Model attachment="waiting"/>');
        expect(waiting).toContain('aria-busy="true"');
        expect(waiting).toContain('h-80');
        expect(waiting).not.toContain('<canvas');
    });

    test('a comparison wipes between two attachments, labeled, and shows the one left when the other is gone', () => {
        const use = (urls: Record<string, { url: string | null; failure: string | null }>) => {
            host = { attachments: { useUrl: (_scope, _chat, id) => urls[id]!, read: () => Promise.reject(new Error('Not read here')) } };
        };

        const source = '<Compare before="a1" after="a2" beforeLabel="Old" afterLabel="New">Header color</Compare>';
        use({ a1: { url: 'blob:a1', failure: null }, a2: { url: 'blob:a2', failure: null } });
        const both = markup(source);
        expect(both).toContain('role="slider"');
        expect(both).toContain('aria-label="Compare Old and New"');
        expect(both).toContain('aria-valuenow="50"');
        expect(both).toContain('src="blob:a1"');
        expect(both).toContain('src="blob:a2"');
        expect(both).toMatch(/>Old<\/span>[\s\S]*>New<\/span>/);
        expect(both).toContain('Header color</figcaption>');
        expect(markup('<Compare before="a1" after="a2"/>')).toContain('aria-label="Compare Before and After"');
        use({ a1: { url: 'blob:a1', failure: null }, a2: { url: null, failure: 'Gone' } });
        const alone = markup(source);
        expect(alone).not.toContain('role="slider"');
        expect(alone).toContain('src="blob:a1"');
        expect(alone).toContain('One image missing');
        use({ a1: { url: null, failure: 'Gone' }, a2: { url: null, failure: 'Gone' } });
        expect(markup(source)).not.toContain('One image missing');
        use({ a1: { url: 'blob:a1', failure: null }, a2: { url: null, failure: null } });
        const loading = markup(source);
        expect(loading).not.toContain('role="slider"');
        expect(loading).not.toContain('src=');
    });

    test('sources are numbered and open through the host only', () => {
        const source = '<Sources><Source title="Docs" url="https://www.adecore.dev/ui"/><Source title="Guide" url="https://example.com"/></Sources>';
        const html = markup(source);
        expect(html).toContain('adecore.dev');
        expect(html).not.toContain('<button');
        expect(html).not.toContain('href');
        expect(markup(source, { openUrl: () => undefined })).toContain('<button');
        expect(html.match(/<li data-ui-source="[^"]+" tabindex="-1"/g)).toHaveLength(2);
    });

    test('a citation is a number that loads nothing, and a button only when it can reveal its source', () => {
        const props = { number: 1, title: 'Docs', url: 'https://www.adecore.dev/ui' };
        const quiet = renderToStaticMarkup(createElement(UiSourceCitation, props));
        expect(quiet).toContain('>1</span>');
        expect(quiet).not.toContain('<button');
        expect(quiet).not.toContain('href');
        expect(quiet).not.toContain('adecore.dev');
        const button = renderToStaticMarkup(createElement(UiSourceCitation, { ...props, onReveal: () => undefined }));
        expect(button).toContain('<button type="button"');
        expect(button).toContain('aria-label="Source 1: Docs"');
        expect(button).not.toContain('href');
    });

    test('structure draws a tab strip and open sections', () => {
        const html = markup(
            '<Tabs><Tab title="First">One</Tab><Tab title="Second">Two</Tab></Tabs><Sections><Section title="Details">Text</Section></Sections>'
        );

        expect(html).toContain('First');
        expect(html).toContain('aria-expanded="true"');
    });

    test('a tab shows its badge beside its title', () => {
        const html = markup('<Tabs><Tab title="Failing" badge="3">One</Tab><Tab title="Passing">Two</Tab></Tabs>');
        expect(html).toMatch(/Failing<span class="[^"]*bg-text\/7 text-text-muted tabular-nums">3<\/span><\/button>/);
        expect(html).toMatch(/>Passing<\/button>/);
    });

    test('a section arrives as open says, and shows its badge as a tag in its tone at the end of its header', () => {
        const html = markup(
            '<Sections><Section title="Risks" open={false} badge="2 open" tone="warning">Hidden</Section><Section title="Details">Shown</Section></Sections>'
        );

        expect(html).toMatch(
            /aria-expanded="false"[^>]*>.*?Risks<\/span><span class="[^"]*bg-status-needs-you\/15 text-status-needs-you">2 open<\/span><\/button><div id="[^"]+" hidden=""/
        );
        expect(html).toMatch(/aria-expanded="true"[^>]*>.*?Details<\/span><\/button>/);
    });

    test('a callout takes the surface of its tone for a warning and a danger, and stays the quiet tile otherwise', () => {
        for (const [tone, surface] of [
            ['warning', 'bg-status-needs-you/12'],
            ['danger', 'bg-status-error/10']
        ]) {
            const html = markup(`<Callout tone="${tone}">Careful</Callout>`);
            expect(html).toContain(`<div class="text-xs flex items-start gap-3 rounded-xl p-3 ${surface}">`);
            // A section flattens a quiet tile and leaves a tinted one its ground.
            expect(html).not.toContain('chat-ui-flat');
        }

        for (const tone of ['neutral', 'info', 'success']) {
            expect(markup(`<Callout tone="${tone}">Note</Callout>`)).toContain(
                '<div class="text-xs flex items-start gap-3 rounded-xl p-3 chat-ui-flat bg-ui-tile">'
            );
        }
    });

    test('a chart shows its title above the drawing and colors a series by the tone it is given', () => {
        const html = markup(
            '<Chart kind="hbar" title="Tests per package" tones={{"failed": "danger"}} data={[{"label": "Core", "passed": 32, "failed": 1}]}/>'
        );

        expect(html).toContain('<figcaption class="text-xs font-medium wrap-break-word text-text">Tests per package</figcaption>');
        expect(html).toContain('background-color:var(--chart-1)');
        expect(html).toContain('background-color:var(--status-error)');
        expect(html).not.toContain('var(--chart-2)');
        expect(html).toContain('lucide-octagon-alert');
        expect(html).toContain('failed<span class="sr-only">, Danger</span>');
        // One toned series still names itself, since its color now means something.
        expect(markup('<Chart kind="hbar" tones={{"n": "success"}} data={[{"label": "a", "n": 1}]}/>')).toContain('lucide-circle-check');
        expect(markup('<Chart kind="hbar" data={[{"label": "a", "n": 1}]}/>')).not.toContain('<figcaption');
    });
});
