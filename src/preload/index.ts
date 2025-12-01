
import { contextBridge, ipcRenderer } from 'electron';

// API exposée au renderer de manière sécurisée
const api = {
    docker: {
        checkConnection: () => ipcRenderer.invoke('docker:check-connection'),
        ping: () => ipcRenderer.invoke('docker:ping'),
        // containers
        listContainers: (all = true) => ipcRenderer.invoke('container:list', all),
        createContainer: (config: any) => ipcRenderer.invoke('container:create', config),
        startContainer: (id: string) => ipcRenderer.invoke('container:start', id),
        stopContainer: (id: string) => ipcRenderer.invoke('container:stop', id),
        removeContainer: (id: string, opts?: any) => ipcRenderer.invoke('container:remove', id, opts),
        getContainerLogs: (id: string, opts?: any) => ipcRenderer.invoke('container:logs', id, opts),
        execInContainer: (id: string, cmd: string[] | string) => ipcRenderer.invoke('container:exec', id, cmd),
        getContainerStats: (id: string) => ipcRenderer.invoke('container:stats', id),
        // images
        listImages: () => ipcRenderer.invoke('image:list'),
        pullImage: (repoTag: string) => ipcRenderer.invoke('image:pull', repoTag),
        removeImage: (idOrName: string, opts?: any) => ipcRenderer.invoke('image:remove', idOrName, opts),
        searchImage: (term: string) => ipcRenderer.invoke('image:search', term),
        getImageDetails: (idOrName: string) => ipcRenderer.invoke('image:get-details', idOrName),
        // Diagnostics
        getDiagnostics: () => ipcRenderer.invoke('docker:diagnostics'),
    },
};

// Expose l'API au renderer
contextBridge.exposeInMainWorld('electronAPI', api);

// Types pour TypeScript
export type ElectronAPI = typeof api;