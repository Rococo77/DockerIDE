
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
        // Listen for progress updates (returns cleanup function)
        onProgress: (callback: (data: { status: string }) => void) => {
            const handler = (_ev: any, data: any) => callback(data);
            ipcRenderer.on('runner:progress', handler);
            return () => ipcRenderer.removeListener('runner:progress', handler);
        },
        // Setup framework in project
        setupFramework: (config: { projectPath: string; image: string; installCommand: string }) =>
            ipcRenderer.invoke('runner:setup-framework', config),
        // Listen for setup progress (returns cleanup function)
        onSetupProgress: (callback: (data: { status: string; type: string }) => void) => {
            const handler = (_ev: any, data: any) => callback(data);
            ipcRenderer.on('runner:setup-progress', handler);
            return () => ipcRenderer.removeListener('runner:setup-progress', handler);
        },
        // Listen for setup output (returns cleanup function)
        onSetupOutput: (callback: (data: { data: string; type: string }) => void) => {
            const handler = (_ev: any, data: any) => callback(data);
            ipcRenderer.on('runner:setup-output', handler);
            return () => ipcRenderer.removeListener('runner:setup-output', handler);
        },
    },
    shell: {
        // Start an interactive shell
        start: (config: { shellId: string; image?: string; language?: string; workspacePath?: string }) =>
            ipcRenderer.invoke('shell:start', config),
        // Send input to shell
        write: (shellId: string, data: string) =>
            ipcRenderer.invoke('shell:write', { shellId, data }),
        // Stop a shell
        stop: (shellId: string) => ipcRenderer.invoke('shell:stop', shellId),
        // List active shells
        list: () => ipcRenderer.invoke('shell:list'),
        // Resize shell terminal
        resize: (shellId: string, cols: number, rows: number) =>
            ipcRenderer.invoke('shell:resize', { shellId, cols, rows }),
        // Listen for shell messages (returns cleanup function)
        onMessage: (callback: (data: { shellId: string; type: string; data: string }) => void) => {
            const handler = (_ev: any, data: any) => callback(data);
            ipcRenderer.on('shell:message', handler);
            return () => ipcRenderer.removeListener('shell:message', handler);
        },
        // Listen for shell close (returns cleanup function)
        onClosed: (callback: (data: { shellId: string }) => void) => {
            const handler = (_ev: any, data: any) => callback(data);
            ipcRenderer.on('shell:closed', handler);
            return () => ipcRenderer.removeListener('shell:closed', handler);
        },
    },
    // Wait for main:ready signal
    whenReady: () => mainReadyPromise,
    onMainReady: (callback: (data?: any) => void) => ipcRenderer.on('main:ready', (_ev, data) => callback(data)),
};

// Expose l'API au renderer
contextBridge.exposeInMainWorld('electronAPI', api);

// Types pour TypeScript
export type ElectronAPI = typeof api;