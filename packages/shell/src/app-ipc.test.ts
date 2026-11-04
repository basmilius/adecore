import { describe, expect, test } from 'bun:test';
import type { BrowserWindow, IpcMain, IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import { createAppIpc } from './app-ipc.ts';

type Registered = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpcMain() {
    const handlers = new Map<string, Registered>();
    const listeners = new Map<string, Registered>();
    const ipcMain = {
        handle: (channel: string, handler: Registered) => handlers.set(channel, handler),
        on: (channel: string, listener: Registered) => listeners.set(channel, listener)
    } as unknown as IpcMain;

    return { ipcMain, handlers, listeners };
}

const APP_PAGE = { id: 1 } as WebContents;
const OTHER_PAGE = { id: 2 } as WebContents;
const WINDOW = { id: 10 } as BrowserWindow;
const eventFrom = (sender: WebContents) => ({ sender }) as IpcMainInvokeEvent & IpcMainEvent;
const fromAppWindow = (event: IpcMainEvent | IpcMainInvokeEvent) => event.sender === APP_PAGE;
const windowOf = (contents: WebContents) => (contents === APP_PAGE ? WINDOW : null);

describe('createAppIpc', () => {
    test('answers a request from the app page and refuses any other page', async () => {
        const fake = fakeIpcMain();
        const ipc = createAppIpc(fake.ipcMain, fromAppWindow, windowOf);
        ipc.handle('file:read', (_event, path: string) => `read ${path}`);
        const handler = fake.handlers.get('file:read')!;

        expect(await handler(eventFrom(APP_PAGE), 'notes.md')).toBe('read notes.md');
        expect(() => handler(eventFrom(OTHER_PAGE), 'notes.md')).toThrow('Only the app window may ask this');
    });

    test('hands a message from the app page to the listener and drops any other', () => {
        const fake = fakeIpcMain();
        const ipc = createAppIpc(fake.ipcMain, fromAppWindow, windowOf);
        const heard: unknown[] = [];
        ipc.on('tray:status', (_event, tone: string) => heard.push(tone));
        const listener = fake.listeners.get('tray:status')!;

        listener(eventFrom(OTHER_PAGE), 'busy');
        listener(eventFrom(APP_PAGE), 'idle');

        expect(heard).toEqual(['idle']);
    });

    test('names the window a page belongs to', () => {
        const ipc = createAppIpc(fakeIpcMain().ipcMain, fromAppWindow, windowOf);

        expect(ipc.senderWindow({ sender: APP_PAGE })).toBe(WINDOW);
        expect(ipc.senderWindow({ sender: OTHER_PAGE })).toBeNull();
    });

    test('registers nothing until the app wires a channel', () => {
        const fake = fakeIpcMain();
        createAppIpc(fake.ipcMain, fromAppWindow, windowOf);

        expect(fake.handlers.size + fake.listeners.size).toBe(0);
    });
});
