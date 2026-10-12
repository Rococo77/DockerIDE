import Docker from 'dockerode';
import log from '../logger';

export interface DockerInfo {
    isConnected: boolean;
    version?: string;
    os?: string;
    architecture?: string;
    containerCount?: number;
    imageCount?: number;
    error?: string;
    usedHost?: string;
}

export class DockerManager {
    // Created on first use, see getDockerInstance()
    private docker: Docker | null = null;
    private static instance: DockerManager;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    public static getInstance(): DockerManager {
        if (!DockerManager.instance) {
            DockerManager.instance = new DockerManager();
        }
        return DockerManager.instance;
    }

    /**
     * Vérifie si Docker est installé et accessible
     */
    public async checkConnection(): Promise<DockerInfo> {
        try {
            // Prefer default client that respects DOCKER_HOST/env (handles TCP/WSL-relay)
            const defaultClient = new Docker();
            const info = await defaultClient.info();
            const version = await defaultClient.version();
            // replace instance for further calls
            this.docker = defaultClient;

            return {
                isConnected: true,
                version: version.Version,
                os: info.OperatingSystem,
                architecture: info.Architecture,
                containerCount: info.Containers,
                imageCount: info.Images,
                usedHost: process.env.DOCKER_HOST ?? (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'),
            };
        } catch (error) {
            log.error('[DockerManager] checkConnection initial error:', error, 'socketPath:', process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock');
            // If first attempt fails, try to create a fallback docker client
            try {
                // Second attempt: try explicit socket path (useful on windows named pipe)
                const fallback = new Docker({
                    socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'
                });
                const info = await fallback.info();
                const version = await fallback.version();
                // replace instance for further calls
                this.docker = fallback;
                return {
                    isConnected: true,
                    version: version.Version,
                    os: info.OperatingSystem,
                    architecture: info.Architecture,
                    containerCount: info.Containers,
                    imageCount: info.Images,
                    usedHost: process.env.DOCKER_HOST ?? (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'),
                };
            } catch (err2) {
                log.error('[DockerManager] fallback connection error:', err2);
                return {
                    isConnected: false,
                    error: this.getErrorMessage(error),
                };
            }
        }
    }

    /**
     * Ping Docker pour vérifier la connexion rapide
     */
    public async ping(): Promise<boolean> {
        try {
            await this.getDockerInstance().ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Docker client shared by every manager, so that they all talk to the daemon found by
     * checkConnection(). dockerode's defaults follow DOCKER_HOST and Docker Desktop's
     * ~/.docker/run/docker.sock. It is created on first use because creating it can throw
     * (e.g. DOCKER_CERT_PATH pointing to a deleted folder), which must not prevent the
     * IPC handlers from registering and the window from opening.
     */
    public getDockerInstance(): Docker {
        if (!this.docker) {
            this.docker = new Docker();
        }
        return this.docker;
    }

    /**
     * Formate le message d'erreur
     */
    private getErrorMessage(error: any): string {
        if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
            return 'Docker n\'est pas démarré ou n\'est pas installé';
        }
        if (error.code === 'EACCES') {
            return 'Permissions insuffisantes pour accéder à Docker';
        }
        return error.message || 'Erreur de connexion à Docker';
    }
}