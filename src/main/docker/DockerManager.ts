import Docker from 'dockerode';

export interface DockerInfo {
    isConnected: boolean;
    version?: string;
    os?: string;
    architecture?: string;
    containerCount?: number;
    imageCount?: number;
    error?: string;
}

export class DockerManager {
    private docker: Docker;
    private static instance: DockerManager;

    private constructor() {
        // Connexion par défaut au socket Docker
        // Windows: npipe, Linux/Mac: socket Unix
        this.docker = new Docker({
            socketPath: process.platform === 'win32'
                ? '//./pipe/docker_engine'
                : '/var/run/docker.sock'
        });
    }

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
            // Try with current docker instance
            const info = await this.docker.info();
            const version = await this.docker.version();

            return {
                isConnected: true,
                version: version.Version,
                os: info.OperatingSystem,
                architecture: info.Architecture,
                containerCount: info.Containers,
                imageCount: info.Images,
            };
        } catch (error) {
            // If first attempt fails, try to create a fallback docker client
            try {
                const fallback = new Docker(); // uses env vars or defaults
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
                };
            } catch (err2) {
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
            await this.docker.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Récupère l'instance Docker (à utiliser par les autres managers)
     */
    public getDockerInstance(): Docker {
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