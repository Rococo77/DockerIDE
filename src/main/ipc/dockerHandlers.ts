import { DockerManager } from '../docker/DockerManager';
import { ContainerManager } from '../docker/ContainerManager';
import { ImageManager } from '../docker/ImageManager';
import { handleIpc } from './ipcHelper';

export function registerDockerHandlers() {
    console.log('[main] registerDockerHandlers() called');
    const dockerManager = DockerManager.getInstance();
    const containerManager = ContainerManager.getInstance();
    const imageManager = ImageManager.getInstance();

    // Docker connection
    handleIpc('docker:check-connection', async () => {
        const info = await dockerManager.checkConnection();
        return { success: true, data: info };
    });

    handleIpc('docker:ping', async () => {
        const isConnected = await dockerManager.ping();
        return { success: true, data: isConnected };
    });

    handleIpc('docker:diagnostics', async () => {
        const env = process.env.DOCKER_HOST ?? null;
        const socketPath = process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
        const dockerInfo = await dockerManager.checkConnection();
        return { success: true, data: { env, socketPath, dockerInfo } };
    });

    // Containers
    handleIpc('container:list', async (all = true) => {
        const list = await containerManager.listContainers(all);
        return { success: true, data: list };
    });

    handleIpc('container:create', async (config: any) => {
        const container = await containerManager.createContainer(config);
        return { success: true, data: container.id };
    });

    handleIpc('container:start', async (id: string) => {
        await containerManager.startContainer(id);
        return { success: true };
    });

    handleIpc('container:stop', async (id: string) => {
        await containerManager.stopContainer(id);
        return { success: true };
    });

    handleIpc('container:remove', async (id: string, opts?: any) => {
        await containerManager.removeContainer(id, opts);
        return { success: true };
    });

    handleIpc('container:logs', async (id: string, opts?: any) => {
        const logs = await containerManager.getContainerLogs(id, opts);
        return { success: true, data: logs };
    });

    handleIpc('container:exec', async (id: string, cmd: string[] | string) => {
        const output = await containerManager.execInContainer(id, cmd);
        return { success: true, data: output };
    });

    handleIpc('container:stats', async (id: string) => {
        const stats = await containerManager.getContainerStats(id, false);
        return { success: true, data: stats };
    });

    // Images
    handleIpc('image:list', async () => {
        const images = await imageManager.listImages();
        return { success: true, data: images };
    });

    handleIpc('image:pull', async (repoTag: string) => {
        await imageManager.pullImage(repoTag);
        return { success: true };
    });

    handleIpc('image:remove', async (idOrName: string, opts?: any) => {
        await imageManager.removeImage(idOrName, opts);
        return { success: true };
    });

    handleIpc('image:search', async (term: string) => {
        const results = await imageManager.searchDockerHub(term);
        return { success: true, data: results };
    });

    handleIpc('image:get-details', async (idOrName: string) => {
        const details = await imageManager.getImageDetails(idOrName);
        return { success: true, data: details };
    });
}
