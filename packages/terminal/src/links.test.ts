import { describe, expect, test } from 'bun:test';
import type { ILinkHandler, ITerminalAddon, Terminal } from '@xterm/xterm';
import { bindTerminalLinks, linkLineBounds } from './links.ts';

function mouse(type: string, properties: Partial<MouseEvent> = {}): MouseEvent {
    return Object.assign(new Event(type, { cancelable: true }), { button: 0, clientX: 10, clientY: 10, ...properties }) as MouseEvent;
}

function terminal() {
    const element = new EventTarget();
    let providers = 0;
    let selected = false;
    const options: { linkHandler: ILinkHandler | null } = { linkHandler: null };
    const term = {
        element,
        options,
        hasSelection: () => selected,
        loadAddon: (addon: ITerminalAddon) => addon.activate(term as unknown as Terminal),
        registerLinkProvider: () => {
            providers++;
            return {
                dispose: () => {
                    providers--;
                }
            };
        }
    };
    return {
        term: term as unknown as Terminal,
        providers: () => providers,
        select: (value: boolean) => {
            selected = value;
        },
        press: () => element.dispatchEvent(mouse('mousedown')),
        activate: (uri: string, event = mouse('mouseup')) => options.linkHandler!.activate(event, uri, { start: { x: 1, y: 1 }, end: { x: 10, y: 1 } })
    };
}

describe('terminal web link callbacks', () => {
    test('each terminal reads its current callback and releases its own provider', () => {
        const first = terminal();
        const second = terminal();
        const opened: string[] = [];
        let label = 'first';
        const disposeFirst = bindTerminalLinks(first.term, () => ({ onOpenLink: (uri) => opened.push(`${label}:${uri}`) }));
        const disposeSecond = bindTerminalLinks(second.term, () => ({ onOpenLink: (uri) => opened.push(`second:${uri}`) }));
        first.press();
        first.activate('https://example.org/one');
        label = 'updated';
        second.press();
        second.activate('https://example.org/two');
        first.press();
        first.activate('https://example.org/three');
        expect(opened).toEqual(['first:https://example.org/one', 'second:https://example.org/two', 'updated:https://example.org/three']);
        disposeFirst();
        expect(first.providers()).toBe(0);
        expect(second.providers()).toBe(1);
        expect(first.term.options.linkHandler).toBeNull();
        disposeSecond();
        expect(second.providers()).toBe(0);
    });

    test('selection, drags, cancelled presses and non-web targets never activate', () => {
        const fixture = terminal();
        const opened: string[] = [];
        const dispose = bindTerminalLinks(fixture.term, () => ({ onOpenLink: (uri) => opened.push(uri) }));
        for (const uri of ['file:///tmp/file', 'javascript:alert(1)', 'data:text/html,test', 'https://']) {
            fixture.press();
            fixture.activate(uri);
        }
        fixture.select(true);
        fixture.press();
        fixture.activate('https://example.org');
        fixture.select(false);
        for (const event of [mouse('mouseup', { button: 1 }), mouse('mouseup', { button: 2 }), mouse('mouseup', { clientX: 30 })]) {
            fixture.press();
            fixture.activate('https://example.org', event);
        }
        fixture.press();
        fixture.term.element!.dispatchEvent(new Event('pointercancel'));
        fixture.activate('https://example.org');
        expect(opened).toEqual([]);
        fixture.press();
        fixture.activate('https://example.org');
        fixture.activate('https://example.org');
        expect(opened).toEqual(['https://example.org']);
        dispose();
    });
});

describe('terminal link tooltip anchors', () => {
    const grid = { cols: 80, rows: 24, viewportY: 100 };
    const screen = { left: 40, top: 100, width: 640, height: 384 };

    test('anchors a link to its whole row segment after scrolling', () => {
        const range = { start: { x: 11, y: 103 }, end: { x: 30, y: 103 } };
        const expected = { x: 120, y: 132, width: 160, height: 16 };
        expect(linkLineBounds(range, grid, screen, 133)).toEqual(expected);
        expect(linkLineBounds(range, grid, screen, 147)).toEqual(expected);
    });

    test('uses the hovered segment of a wrapped link and follows canvas scale', () => {
        const range = { start: { x: 60, y: 102 }, end: { x: 20, y: 104 } };
        expect(linkLineBounds(range, grid, screen, 120)).toEqual({ x: 512, y: 116, width: 168, height: 16 });
        expect(linkLineBounds(range, grid, screen, 140)).toEqual({ x: 40, y: 132, width: 640, height: 16 });
        expect(linkLineBounds(range, grid, screen, 150)).toEqual({ x: 40, y: 148, width: 160, height: 16 });
        expect(linkLineBounds(range, grid, { ...screen, width: 320, height: 192 }, 125)).toEqual({ x: 40, y: 124, width: 80, height: 8 });
        expect(linkLineBounds(range, grid, { ...screen, width: 0 }, 125)).toBeNull();
    });
});
