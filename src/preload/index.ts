
import { contextBridge, ipcRenderer } from 'electron';
console.log('[preload] preload script running — exposing electronAPI');

// Promise that resolves when main signals it's ready (handlers registered)
let _mainReadyResolved = false;
let _mainReadyResolver: ((data?: any) => void) | null = null;
const mainReadyPromise = new Promise<any>((resolve) => {
    _mainReadyResolver = (data: any) => {
        _mainReadyResolved = true;
        resolve(data);
    };
});

// Listen for main ready event
ipcRenderer.on('main:ready', (_event, data) => {
    console.log('[preload] received main:ready:', data);
    try {
        _mainReadyResolver?.(data);
    } catch (err) {
        console.error('[preload] error resolving mainReady', err);
    }
});

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
    fs: {
        // Folder operations
        openFolder: () => ipcRenderer.invoke('fs:open-folder'),
        getWorkspace: () => ipcRenderer.invoke('fs:get-workspace'),
        setWorkspace: (path: string) => ipcRenderer.invoke('fs:set-workspace', path),
        // File/directory operations
        readDirectory: (path: string, depth?: number) => ipcRenderer.invoke('fs:read-directory', path, depth),
        readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
        writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
        createFile: (path: string, content?: string) => ipcRenderer.invoke('fs:create-file', path, content),
        createDirectory: (path: string) => ipcRenderer.invoke('fs:create-directory', path),
        delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
        rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
        exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
        // Helpers
        getLanguage: (path: string) => ipcRenderer.invoke('fs:get-language', path),
        getDockerImage: (language: string) => ipcRenderer.invoke('fs:get-docker-image', language),
    },
    runner: {
        // Run code in Docker container
        run: (config: { filePath: string; workspacePath: string; language: string }) =>
            ipcRenderer.invoke('runner:run', config),
        // Get supported languages
        getLanguages: () => ipcRenderer.invoke('runner:get-languages'),
        // Get language configuration
        getLanguageConfig: (language: string) => ipcRenderer.invoke('runner:get-language-config', language),
        // Check if image is available
        checkImage: (imageName: string) => ipcRenderer.invoke('runner:check-image', imageName),
        // Ensure image is pulled
        ensureImage: (imageName: string) => ipcRenderer.invoke('runner:ensure-image', imageName),
        // Listen for progress updates
        onProgress: (callback: (data: { status: string }) => void) =>
            ipcRenderer.on('runner:progress', (_ev, data) => callback(data)),
    },
    // Wait for main:ready signal
    whenReady: () => mainReadyPromise,
    onMainReady: (callback: (data?: any) => void) => ipcRenderer.on('main:ready', (_ev, data) => callback(data)),
};

// Expose l'API au renderer
contextBridge.exposeInMainWorld('electronAPI', api);

// Types pour TypeScript
export type ElectronAPI = typeof api;