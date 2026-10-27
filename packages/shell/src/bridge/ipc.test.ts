import { describe, expect, test } from 'bun:test';
import { ipcSubscriber, type IpcListeners } from './ipc.ts';

type Listener = (event: unknown, ...args: unknown[]) => void;

function fakeIpc() {
    const listeners = new Map<string, Set<Listener>>();
    const ipc: IpcListeners = {
        on: (channel, listener) => {
            listeners.set(channel, (listeners.get(channel) ?? new Set()).add(listener));
        },
        removeListener: (channel, listener) => {
            listeners.get(channel)?.delete(listener);
        }
    };
    const send = (channel: string, ...args: unknown[]): void => {
        for (const listener of listeners.get(channel) ?? []) {
            listener({ sender: 'main' }, ...args);
        }
    };

    return { ipc, send };
}

describe('ipcSubscriber', () => {
    test('hands the listener what the main process sent, without the event', () => {
        const { ipc, send } = fakeIpc();
        const heard: unknown[][] = [];
        ipcSubscriber(ipc)<[key: string, x: number]>('window:drag')((...args) => heard.push(args));
        send('window:drag', 'a', 12);
        send('window:other', 'b', 1);

        expect(heard).toEqual([['a', 12]]);
    });

    test('stops hearing once removed, and leaves other listeners on the channel', () => {
        const { ipc, send } = fakeIpc();
        const subscribe = ipcSubscriber(ipc)<[id: string]>('menu:run');
        const first: string[] = [];
        const second: string[] = [];
        const removeFirst = subscribe((id) => first.push(id));
        subscribe((id) => second.push(id));
        send('menu:run', 'copy');
        removeFirst();
        send('menu:run', 'paste');

        expect(first).toEqual(['copy']);
        expect(second).toEqual(['copy', 'paste']);
    });
});
