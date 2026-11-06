import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Copy, Scan, Send } from 'lucide-react';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import * as ContextMenu from '../context-menu/index.parts.ts';
import { Icon } from '../Icon.tsx';
import { Kbd } from '../Kbd.tsx';
import { EDIT_SHORTCUTS } from '../shortcut.ts';
import * as Menu from './index.parts.ts';

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/menu/typeahead.test.tsx`.
describe.skipIf(typeof document === 'undefined')('typing in an open menu', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        jest.useRealTimers();
    });

    const render = async (node: ReactNode): Promise<void> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));
    };

    const open = (rows: ReactNode): Promise<void> =>
        render(
            <Menu.Root defaultOpen>
                <Menu.Trigger>Open</Menu.Trigger>
                <Menu.Popup>{rows}</Menu.Popup>
            </Menu.Root>
        );

    const press = async (key: string): Promise<KeyboardEvent> => {
        const target =
            document.activeElement instanceof HTMLElement && document.activeElement !== document.body
                ? document.activeElement
                : document.querySelector<HTMLElement>('[role="menu"]')!;
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        await act(async () => {
            target.dispatchEvent(event);
        });

        return event;
    };

    const type = async (keys: string): Promise<void> => {
        for (const key of keys) {
            await press(key);
        }
    };

    // Letters typed close together are one word; a pause starts the next.
    const pause = async (): Promise<void> => {
        await act(async () => jest.advanceTimersByTime(1000));
    };

    const highlighted = (): string | null => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;

    test('moves to the first row whose name starts with the letters', async () => {
        await open(
            <>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Select all</Menu.Item>
                <Menu.Item>Send</Menu.Item>
            </>
        );

        await type('sen');
        expect(highlighted()).toBe('Send');
    });

    test('finds a row with an icon before its name and a shortcut after it', async () => {
        await open(
            <>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>
                    <Icon icon={Copy} size={14} /> Copy <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                </Menu.Item>
                <Menu.Item>
                    <Icon icon={Scan} size={14} /> {'Select all'}
                </Menu.Item>
            </>
        );

        await type('c');
        expect(highlighted()).toStartWith('Copy');

        await pause();
        await type('s');
        expect(highlighted()).toBe('Select all');
    });

    test('goes to the next row with the same first letter on each press', async () => {
        await open(
            <>
                <Menu.Item>Select all</Menu.Item>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Send</Menu.Item>
            </>
        );

        await type('s');
        expect(highlighted()).toBe('Select all');

        await type('s');
        expect(highlighted()).toBe('Send');
    });

    test('matches on the label of a row whose text starts with something else', async () => {
        await open(
            <>
                <Menu.Item>Archive</Menu.Item>
                <Menu.Item label="Website">
                    <span>WS</span> Website
                </Menu.Item>
            </>
        );

        await type('we');
        expect(highlighted()).toEndWith('Website');
    });

    test('reaches check, radio and submenu rows', async () => {
        await open(
            <>
                <Menu.CheckboxItem>
                    <Icon icon={Scan} size={14} /> Wrap lines
                </Menu.CheckboxItem>
                <Menu.RadioGroup value="light">
                    <Menu.RadioItem value="light">Light</Menu.RadioItem>
                    <Menu.RadioItem value="dark">Dark</Menu.RadioItem>
                </Menu.RadioGroup>
                <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>
                        <Icon icon={Send} size={14} /> Move to
                    </Menu.SubmenuTrigger>
                    <Menu.Popup>
                        <Menu.Item>Inbox</Menu.Item>
                    </Menu.Popup>
                </Menu.SubmenuRoot>
            </>
        );

        await type('w');
        expect(highlighted()).toBe('Wrap lines');

        await pause();
        await type('d');
        expect(highlighted()).toBe('Dark');

        await pause();
        await type('m');
        expect(highlighted()).toBe('Move to');
    });

    test('runs the row it moved to on Enter', async () => {
        const ran: string[] = [];

        await open(
            <>
                <Menu.Item onClick={() => ran.push('rename')}>Rename</Menu.Item>
                <Menu.Item onClick={() => ran.push('send')}>Send</Menu.Item>
            </>
        );

        await type('s');
        await press('Enter');
        expect(ran).toEqual(['send']);
    });

    test('keeps a typed letter from the rest of the window', async () => {
        const heard: string[] = [];
        const listen = (event: KeyboardEvent): void => {
            heard.push(event.key);
        };

        window.addEventListener('keydown', listen);

        try {
            await open(<Menu.Item>Send</Menu.Item>);

            const event = await press('s');
            expect(event.defaultPrevented).toBe(true);
            expect(heard).toEqual([]);
        } finally {
            window.removeEventListener('keydown', listen);
        }
    });

    test('works the same in a context menu', async () => {
        await render(
            <ContextMenu.Root>
                <ContextMenu.Trigger>Area</ContextMenu.Trigger>
                <ContextMenu.Popup>
                    <ContextMenu.Item>
                        <Icon icon={Copy} size={14} /> Copy
                    </ContextMenu.Item>
                    <ContextMenu.Item>
                        <Icon icon={Scan} size={14} /> Select all
                    </ContextMenu.Item>
                </ContextMenu.Popup>
            </ContextMenu.Root>
        );

        const area = container.firstElementChild!;
        await act(async () => {
            area.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
        });
        await type('s');
        expect(highlighted()).toBe('Select all');
    });
});
