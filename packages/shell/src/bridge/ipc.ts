/* The part of `ipcRenderer` a subscription uses, so this module imports nothing from Electron. */
export interface IpcListeners {
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
    removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
}

export type Subscribe<Args extends unknown[]> = (listener: (...args: Args) => void) => () => void;

/*
 * For a preload: turns a channel the main process sends on into what the page subscribes with, a
 * listener in and what removes it again out. The event stays behind: it carries the sender, which the
 * page must never hold.
 */
export const ipcSubscriber =
    (ipc: IpcListeners) =>
    <Args extends unknown[]>(channel: string): Subscribe<Args> =>
    (listener) => {
        const handler = (_event: unknown, ...args: unknown[]): void => listener(...(args as Args));
        ipc.on(channel, handler);

        return () => {
            ipc.removeListener(channel, handler);
        };
    };
