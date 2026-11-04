import type { BrowserWindow, IpcMain, IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';

/* The channels of the app's own pages. A channel refuses every other page. */
export interface AppIpc {
    handle<Args extends unknown[]>(channel: string, handler: (event: IpcMainInvokeEvent, ...args: Args) => unknown): void;
    on<Args extends unknown[]>(channel: string, listener: (event: IpcMainEvent, ...args: Args) => void): void;

    /* The app window whose page sent it. */
    senderWindow(event: { sender: WebContents }): BrowserWindow | null;
}

function refuseOtherPages(): never {
    throw new Error('Only the app window may ask this');
}

/*
 * Puts the app's sender check in front of every channel it wires, so no channel can forget it. A page
 * the window was navigated to would otherwise inherit the bridge. The check is the app's own, usually
 * `isAppSender` over its windows; this registers a channel only when the app asks for one.
 */
export function createAppIpc(
    ipcMain: IpcMain,
    fromAppWindow: (event: IpcMainEvent | IpcMainInvokeEvent) => boolean,
    windowOf: (contents: WebContents) => BrowserWindow | null
): AppIpc {
    return {
        handle<Args extends unknown[]>(channel: string, handler: (event: IpcMainInvokeEvent, ...args: Args) => unknown): void {
            ipcMain.handle(channel, (event, ...args) => (fromAppWindow(event) ? handler(event, ...(args as Args)) : refuseOtherPages()));
        },
        on<Args extends unknown[]>(channel: string, listener: (event: IpcMainEvent, ...args: Args) => void): void {
            ipcMain.on(channel, (event, ...args) => {
                if (fromAppWindow(event)) {
                    listener(event, ...(args as Args));
                }
            });
        },
        senderWindow: (event) => windowOf(event.sender)
    };
}
