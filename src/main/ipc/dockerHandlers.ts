import { ipcMain } from 'electron';
import { DockerManager } from '../docker/DockerManager';
import { ContainerManager } from '../docker/ContainerManager';
import { ImageManager } from '../docker/ImageManager';

export function registerDockerHandlers() {
    const dockerManager = DockerManager.getInstance();
    const containerManager = ContainerManager.getInstance();
    const imageManager = ImageManager.getInstance();

    /**
     * Vérifier la connexion Docker
     */
    ipcMain.handle('docker:check-connection', async () => {
        try {
            const info = await dockerManager.checkConnection();
            if (!info.isConnected) {
                console.warn('[docker:check-connection] Docker not connected:', info.error);
            }
            return { success: true, data: info };
        } catch (error: any) {
            console.error('[docker:check-connection] handler error:', error);
            return { success: false, error: error?.message ?? String(error) };
        }
    });

    /**
     * Ping Docker (vérification rapide)
     */
    ipcMain.handle('docker:ping', async () => {
        try {
            const isConnected = await dockerManager.ping();
            return { success: true, data: isConnected };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('docker:diagnostics', async () => {
        try {
            const env = process.env.DOCKER_HOST ?? null;
            const socketPath = process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
            const dockerInfo = await dockerManager.checkConnection();
            return { success: true, data: { env, socketPath, dockerInfo } };
        } catch (err: any) {
            console.error('[docker:diagnostics] handler error:', err);
            return { success: false, error: err?.message ?? String(err) };
        }
    });

    // Containers
    ipcMain.handle('container:list', async (_event, all = true) => {
        try {
            const list = await containerManager.listContainers(all);
            return { success: true, data: list };
        } catch (error: any) {
            console.error('[container:list] handler error:', error);
            return { success: false, error: error?.message ?? String(error) };
        }
    });

    ipcMain.handle('container:create', async (_event, config) => {
        try {
            const container = await containerManager.createContainer(config);
            return { success: true, data: container.id || container.id };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('container:start', async (_event, id: string) => {
        try {
            await containerManager.startContainer(id);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('container:stop', async (_event, id: string) => {
        try {
            await containerManager.stopContainer(id);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('container:remove', async (_event, id: string, opts?: any) => {
        try {
            await containerManager.removeContainer(id, opts);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('container:logs', async (_event, id: string, opts?: any) => {
        try {
            const logs = await containerManager.getContainerLogs(id, opts);
            return { success: true, data: logs };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('container:exec', async (_event, id: string, cmd: string[] | string) => {
        try {
            const output = await containerManager.execInContainer(id, cmd);
            return { success: true, data: output };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('container:stats', async (_event, id: string) => {
        try {
            const stats = await containerManager.getContainerStats(id, false);
            return { success: true, data: stats };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Images
    ipcMain.handle('image:list', async () => {
        try {
            const images = await imageManager.listImages();
            return { success: true, data: images };
        } catch (error: any) {
            console.error('[image:list] handler error:', error);
            return { success: false, error: error?.message ?? String(error) };
        }
    });

    ipcMain.handle('image:pull', async (_event, repoTag: string) => {
        try {
            await imageManager.pullImage(repoTag);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('image:remove', async (_event, idOrName: string, opts?: any) => {
        try {
            await imageManager.removeImage(idOrName, opts);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('image:search', async (_event, term: string) => {
        try {
            const results = await imageManager.searchDockerHub(term);
            return { success: true, data: results };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('image:get-details', async (_event, idOrName: string) => {
        try {
            const details = await imageManager.getImageDetails(idOrName);
            return { success: true, data: details };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
}