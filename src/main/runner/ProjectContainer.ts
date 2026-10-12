import Docker from 'dockerode';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import * as path from 'path';
import { Writable } from 'stream';
import { StringDecoder } from 'string_decoder';
import { DockerManager } from '../docker/DockerManager';
import { ImageManager } from '../docker/ImageManager';
import log from '../logger';

interface ProjectContainerConfig {
    projectPath: string;
    image: string;
    language?: string;
}

interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    status: 'running' | 'stopped' | 'creating';
    projectPath: string;
}

interface ExecResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode: number;
    executionTime?: number;
}

/**
 * Manages persistent Docker containers for projects.
 * Each project gets a single container that persists across executions.
 */
export class ProjectContainerManager extends EventEmitter {
    private static instance: ProjectContainerManager;
    private containers: Map<string, ContainerInfo> = new Map();
    // Containers being looked up or created, so that two runs started together
    // (F5 and the Run button) share one container instead of both creating it
    private pendingContainers = new Map<string, Promise<ContainerInfo>>();

    // Prefix for container names to identify Docker IDE containers
    private static readonly CONTAINER_PREFIX = 'docker-ide-project-';

    private constructor() {
        super();
        // Load existing containers on startup
        this.syncExistingContainers();
    }

    // The client shared with the other managers, looked up on each call
    private get docker(): Docker {
        return DockerManager.getInstance().getDockerInstance();
    }

    static getInstance(): ProjectContainerManager {
        if (!ProjectContainerManager.instance) {
            ProjectContainerManager.instance = new ProjectContainerManager();
        }
        return ProjectContainerManager.instance;
    }

    /**
     * Container name for a project: its folder name, readable in Docker tools, plus a hash
     * of its full path, so that two projects with the same folder name in different places
     * (~/cours/tp1 and ~/perso/tp1) never share a container mounted on the other folder.
     */
    private getContainerName(projectPath: string): string {
        const resolved = path.resolve(projectPath);
        // Windows paths are case-insensitive
        const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
        const hash = createHash('sha256').update(key).digest('hex').slice(0, 12);
        const projectName = path.basename(resolved)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40);
        return `${ProjectContainerManager.CONTAINER_PREFIX}${projectName ? `${projectName}-` : ''}${hash}`;
    }

    /**
     * Sync with existing Docker containers on startup
     */
    private async syncExistingContainers(): Promise<void> {
        try {
            const containers = await this.docker.listContainers({ all: true });
            
            for (const containerInfo of containers) {
                const name = containerInfo.Names[0]?.replace(/^\//, '') || '';
                
                if (name.startsWith(ProjectContainerManager.CONTAINER_PREFIX)) {
                    // Extract project path from labels if available
                    const projectPath = containerInfo.Labels?.['docker-ide.project-path'] || '';
                    
                    this.containers.set(name, {
                        id: containerInfo.Id,
                        name,
                        image: containerInfo.Image,
                        status: containerInfo.State === 'running' ? 'running' : 'stopped',
                        projectPath,
                    });
                }
            }
            
            log.info(`[ProjectContainer] Synced ${this.containers.size} existing containers`);
        } catch (error) {
            log.error('[ProjectContainer] Error syncing containers:', error);
        }
    }

    /**
     * Get or create a container for a project
     */
    async getOrCreateContainer(config: ProjectContainerConfig): Promise<ContainerInfo> {
        const containerName = this.getContainerName(config.projectPath);
        const pending = this.pendingContainers.get(containerName);
        if (pending) {
            return pending;
        }

        const lookup = this.findOrCreateContainer(config, containerName)
            .finally(() => this.pendingContainers.delete(containerName));
        this.pendingContainers.set(containerName, lookup);
        return lookup;
    }

    private async findOrCreateContainer(config: ProjectContainerConfig, containerName: string): Promise<ContainerInfo> {
        // Check if we already have this container in memory
        let containerInfo = this.containers.get(containerName);
        
        if (containerInfo) {
            // Verify container still exists in Docker
            try {
                const container = this.docker.getContainer(containerInfo.id);
                const inspect = await container.inspect();
                
                // Update status
                containerInfo.status = inspect.State.Running ? 'running' : 'stopped';
                
                // Check if image matches, if not we need to recreate
                if (inspect.Config.Image !== config.image) {
                    log.info(`[ProjectContainer] Image changed for ${containerName}, recreating...`);
                    await this.removeContainer(config.projectPath);
                    containerInfo = undefined;
                }
            } catch (error: any) {
                // Container doesn't exist anymore
                log.info(`[ProjectContainer] Container ${containerName} no longer exists, will recreate`);
                this.containers.delete(containerName);
                containerInfo = undefined;
            }
        }

        // Check Docker directly if not in memory
        if (!containerInfo) {
            try {
                const containers = await this.docker.listContainers({
                    all: true,
                    // Docker matches names partially ("tp1" would find "tp10"): anchor it
                    filters: { name: [`^/${containerName}$`] }
                });
                
                if (containers.length > 0) {
                    const existing = containers[0];
                    containerInfo = {
                        id: existing.Id,
                        name: containerName,
                        image: existing.Image,
                        status: existing.State === 'running' ? 'running' : 'stopped',
                        projectPath: config.projectPath,
                    };
                    this.containers.set(containerName, containerInfo);
                }
            } catch (error) {
                // Ignore, will create new container
            }
        }

        // Create new container if needed
        if (!containerInfo) {
            containerInfo = await this.createContainer(config, containerName);
        }

        // Ensure container is running
        if (containerInfo.status !== 'running') {
            await this.startContainer(containerInfo.id);
            containerInfo.status = 'running';
        }

        return containerInfo;
    }

    /**
     * Create a new container for a project
     */
    private async createContainer(config: ProjectContainerConfig, containerName: string): Promise<ContainerInfo> {
        this.emit('status', { 
            projectPath: config.projectPath, 
            status: 'creating',
            message: `Creating container ${containerName}...`
        });

        // Ensure image exists
        const imageManager = ImageManager.getInstance();
        if (!(await imageManager.hasImage(config.image))) {
            this.emit('status', {
                projectPath: config.projectPath,
                status: 'pulling',
                message: `Downloading image ${config.image}...`
            });
            await imageManager.pullImage(config.image);
        }

        // Create the container
        const container = await this.docker.createContainer({
            Image: config.image,
            name: containerName,
            Cmd: ['/bin/sh', '-c', 'tail -f /dev/null'], // Keep container running
            WorkingDir: '/workspace',
            Tty: true,
            OpenStdin: true,
            Labels: {
                'docker-ide.project-path': config.projectPath,
                'docker-ide.language': config.language || '',
                'docker-ide.managed': 'true',
            },
            HostConfig: {
                Binds: [`${config.projectPath}:/workspace`],
                // No AutoRemove - we want persistent containers
                NetworkMode: 'bridge',
                Memory: 256 * 1024 * 1024, // 256MB default
                MemorySwap: 512 * 1024 * 1024, // 512MB swap
            },
        });

        const containerInfo: ContainerInfo = {
            id: container.id,
            name: containerName,
            image: config.image,
            status: 'stopped',
            projectPath: config.projectPath,
        };

        this.containers.set(containerName, containerInfo);

        // Install build tools for compiled languages using alpine images
        if (config.image.startsWith('alpine:') && (config.language === 'c' || config.language === 'cpp')) {
            try {
                await container.start();
                containerInfo.status = 'running';
                const setupExec = await container.exec({
                    Cmd: ['sh', '-c', 'apk add --no-cache gcc g++ musl-dev make'],
                    AttachStdout: true,
                    AttachStderr: true,
                });
                const setupStream = await setupExec.start({ hijack: true, stdin: false });
                // The output isn't shown, but it must be read: a stream that nobody
                // reads never emits 'end', which made the first C/C++ run hang forever
                setupStream.resume();
                await new Promise<void>((resolve, reject) => {
                    setupStream.on('end', resolve);
                    setupStream.on('close', resolve);
                    setupStream.on('error', reject);
                });
                const exitCode = await this.waitForExitCode(setupExec);
                if (exitCode !== 0) {
                    throw new Error(`apk add exited with code ${exitCode}`);
                }
            } catch (error: any) {
                // Don't keep a container without a compiler: the next run tries again
                this.containers.delete(containerName);
                await container.remove({ force: true }).catch((): void => undefined);
                throw new Error(`Impossible d'installer le compilateur C/C++ dans le conteneur (${error.message}). Vérifiez la connexion réseau.`);
            }
        }

        this.emit('status', {
            projectPath: config.projectPath,
            status: 'created',
            message: `Container ${containerName} ready`
        });

        return containerInfo;
    }

    /**
     * Start a container
     */
    async startContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            const inspect = await container.inspect();
            
            if (!inspect.State.Running) {
                await container.start();
                log.info(`[ProjectContainer] Started container ${containerId}`);
            }
        } catch (error: any) {
            log.error(`[ProjectContainer] Error starting container:`, error);
            throw error;
        }
    }

    /**
     * Execute a command in the project container
     */
    async exec(projectPath: string, command: string[], config?: {
        image?: string;
        language?: string;
        onOutput?: (data: string, type: 'stdout' | 'stderr') => void;
    }): Promise<ExecResult> {
        const startTime = Date.now();
        
        // Get or create the container
        const containerInfo = await this.getOrCreateContainer({
            projectPath,
            image: config?.image || 'alpine:latest',
            language: config?.language,
        });

        try {
            const container = this.docker.getContainer(containerInfo.id);
            
            // Create exec instance
            const exec = await container.exec({
                Cmd: command,
                AttachStdout: true,
                AttachStderr: true,
                WorkingDir: '/workspace',
            });

            // Start exec and capture output
            const stream = await exec.start({ hijack: true, stdin: false });

            let stdout = '';
            let stderr = '';
            const collect = (type: 'stdout' | 'stderr') => {
                // Keeps multi-byte characters split across frames intact
                const decoder = new StringDecoder('utf8');
                return new Writable({
                    write(chunk: Buffer, _encoding, callback) {
                        const text = decoder.write(chunk);
                        if (type === 'stderr') {
                            stderr += text;
                        } else {
                            stdout += text;
                        }
                        if (text) config?.onOutput?.(text, type);
                        callback();
                    },
                });
            };

            // Non-TTY exec output is multiplexed (an 8-byte header per frame) and a frame can
            // be split across chunks: docker-modem reassembles the frames
            this.docker.modem.demuxStream(stream, collect('stdout'), collect('stderr'));
            await new Promise<void>((resolve, reject) => {
                stream.on('end', () => resolve());
                stream.on('error', (err) => reject(err));
            });

            const exitCode = (await this.waitForExitCode(exec)) ?? 0;

            return {
                success: exitCode === 0,
                output: stdout,
                error: stderr || undefined,
                exitCode,
                executionTime: Date.now() - startTime,
            };

        } catch (error: any) {
            return {
                success: false,
                output: '',
                error: error.message,
                exitCode: -1,
                executionTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Exit code of a finished exec. The output stream can end just before Docker records
     * the exit code, so wait a little for it instead of reading null.
     */
    private async waitForExitCode(exec: Docker.Exec): Promise<number | null> {
        for (let attempt = 0; attempt < 20; attempt++) {
            const { Running, ExitCode } = await exec.inspect();
            if (!Running && ExitCode !== null) return ExitCode;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return null;
    }

    /**
     * Stop a project's container
     */
    async stopContainer(projectPath: string): Promise<void> {
        const containerName = this.getContainerName(projectPath);
        const containerInfo = this.containers.get(containerName);

        if (containerInfo) {
            try {
                const container = this.docker.getContainer(containerInfo.id);
                await container.stop({ t: 2 });
                containerInfo.status = 'stopped';
                log.info(`[ProjectContainer] Stopped container ${containerName}`);
            } catch (error: any) {
                if (error?.statusCode === 404) {
                    // Removed outside the IDE (Docker panel, CLI)
                    this.containers.delete(containerName);
                } else if (error?.statusCode === 304) {
                    containerInfo.status = 'stopped';
                } else {
                    log.error(`[ProjectContainer] Error stopping container:`, error);
                }
            }
        }
    }

    /**
     * Remove a project's container
     */
    async removeContainer(projectPath: string): Promise<void> {
        const containerName = this.getContainerName(projectPath);
        const containerInfo = this.containers.get(containerName);
        
        if (containerInfo) {
            try {
                const container = this.docker.getContainer(containerInfo.id);
                
                // Stop if running
                try {
                    await container.stop({ t: 1 });
                } catch {
                    // Already stopped
                }
                
                // Remove
                await container.remove({ force: true });
                this.containers.delete(containerName);
                
                log.info(`[ProjectContainer] Removed container ${containerName}`);
            } catch (error: any) {
                log.error(`[ProjectContainer] Error removing container:`, error);
                this.containers.delete(containerName);
            }
        }
    }

    /**
     * Get container info for a project
     */
    getContainerInfo(projectPath: string): ContainerInfo | undefined {
        const containerName = this.getContainerName(projectPath);
        return this.containers.get(containerName);
    }

    /**
     * Container info checked against Docker: the container may have been stopped or
     * removed outside the runner (Docker panel, CLI), which left the status bar stale.
     */
    async refreshContainerInfo(projectPath: string): Promise<ContainerInfo | undefined> {
        const containerName = this.getContainerName(projectPath);
        const info = this.containers.get(containerName);
        if (!info) return undefined;

        try {
            const inspect = await this.docker.getContainer(info.id).inspect();
            info.status = inspect.State.Running ? 'running' : 'stopped';
            return info;
        } catch (error: any) {
            if (error?.statusCode === 404) {
                this.containers.delete(containerName);
                return undefined;
            }
            // Docker unreachable: keep the last known state
            return info;
        }
    }

    /**
     * List all managed containers
     */
    listContainers(): ContainerInfo[] {
        return Array.from(this.containers.values());
    }

    /**
     * Check if a project has a running container
     */
    isContainerRunning(projectPath: string): boolean {
        const containerName = this.getContainerName(projectPath);
        const info = this.containers.get(containerName);
        return info?.status === 'running';
    }

    /**
     * Stop all managed containers
     */
    async stopAll(): Promise<void> {
        for (const [name, info] of this.containers) {
            try {
                const container = this.docker.getContainer(info.id);
                await container.stop({ t: 1 });
                info.status = 'stopped';
            } catch {
                // Ignore errors
            }
        }
    }

    /**
     * Remove all managed containers
     */
    async removeAll(): Promise<void> {
        for (const [name, info] of this.containers) {
            try {
                const container = this.docker.getContainer(info.id);
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await container.stop({ t: 1 }).catch(() => {});
                await container.remove({ force: true });
            } catch {
                // Ignore errors
            }
        }
        this.containers.clear();
    }
}

export default ProjectContainerManager;
