import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type DatabaseBridge } from '../shared/bridge.ts';

const bridge: DatabaseBridge = {
    request: (request) => ipcRenderer.invoke(CHANNELS.request, request),
    browse: () => ipcRenderer.invoke(CHANNELS.browse),
    demoPath: () => ipcRenderer.invoke(CHANNELS.demoPath),
    saveFile: (options) => ipcRenderer.invoke(CHANNELS.saveFile, options),
    openFile: (options) => ipcRenderer.invoke(CHANNELS.openFile, options)
};

contextBridge.exposeInMainWorld('database', bridge);
