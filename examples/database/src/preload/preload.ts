import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type DatabaseBridge } from '../shared/bridge.ts';

const bridge: DatabaseBridge = {
    request: (request) => ipcRenderer.invoke(CHANNELS.request, request),
    browse: () => ipcRenderer.invoke(CHANNELS.browse),
    demoPath: () => ipcRenderer.invoke(CHANNELS.demoPath)
};

contextBridge.exposeInMainWorld('database', bridge);
