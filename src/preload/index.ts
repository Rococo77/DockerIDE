
import { contextBridge, ipcRenderer } from 'electron';

// API exposée au renderer de manière sécurisée
const api = {
    docker: {
        checkConnection: () => ipcRenderer.invoke('docker:check-connection'),
        ping: () => ipcRenderer.invoke('docker:ping'),
    },
};

// Expose l'API au renderer
contextBridge.exposeInMainWorld('electronAPI', api);

// Types pour TypeScript
export type ElectronAPI = typeof api;