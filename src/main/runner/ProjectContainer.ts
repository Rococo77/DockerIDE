import Docker from 'dockerode';
import { EventEmitter } from 'events';
import * as path from 'path';

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
    private docker: Docker;
    private containers: Map<string, ContainerInfo> = new Map();
    
    // Prefix for container names to identify Docker IDE containers
    private static readonly CONTAINER_PREFIX = 'docker-ide-project-';

    private constructor() {
        super();
        this.docker = new Docker();
        // Load existing containers on startup
        this.syncExistingContainers();
    }

    static getInstance(): ProjectContainerManager {
        if (!ProjectContainerManager.instance) {
            ProjectContainerManager.instance = new ProjectContainerManager();
        }
        return ProjectContainerManager.instance;
    }

    /**
     * Generate a unique container name based on project path
     */
    private getContainerName(projectPath: string): string {
        const projectName = path.basename(projectPath)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return `${ProjectContainerManager.CONTAINER_PREFIX}${projectName}`;
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
            
            console.log(`[ProjectContainer] Synced ${this.containers.size} existing containers`);
        } catch (error) {
            console.error('[ProjectContainer] Error syncing containers:', error);
        }
    }

    /**
     * Get or create a container for a project
     */
    async getOrCreateContainer(config: ProjectContainerConfig): Promise<ContainerInfo> {
        const containerName = this.getContainerName(config.projectPath);
        
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
                    console.log(`[ProjectContainer] Image changed for ${containerName}, recreating...`);
                    await this.removeContainer(config.projectPath);
                    containerInfo = undefined;
                }
            } catch (error: any) {
                // Container doesn't exist anymore
                console.log(`[ProjectContainer] Container ${containerName} no longer exists, will recreate`);
                this.containers.delete(containerName);
                containerInfo = undefined;
            }
        }

        // Check Docker directly if not in memory
        if (!containerInfo) {
            try {
                const containers = await this.docker.listContainers({ 
                    all: true,
                    filters: { name: [containerName] }
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
        try {
            await this.docker.getImage(config.image).inspect();
        } catch {
            this.emit('status', { 
                projectPath: config.projectPath, 
                status: 'pulling',
                message: `Downloading image ${config.image}...`
            });

            await new Promise<void>((resolve, reject) => {
                this.docker.pull(config.image, (err: any, stream: NodeJS.ReadableStream) => {
                    if (err) return reject(err);
                    this.docker.modem.followProgress(stream, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
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
            await container.start();
            containerInfo.status = 'running';
            const setupExec = await container.exec({
                Cmd: ['sh', '-c', 'apk add --no-cache gcc g++ musl-dev make'],
                AttachStdout: true,
                AttachStderr: true,
            });
            const setupStream = await setupExec.start({ hijack: true, stdin: false });
            await new Promise<void>((resolve) => {
                setupStream.on('end', resolve);
                setupStream.on('error', () => resolve());
            });
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
                console.log(`[ProjectContainer] Started container ${containerId}`);
            }
        } catch (error: any) {
            console.error(`[ProjectContainer] Error starting container:`, error);
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

            await new Promise<void>((resolve, reject) => {
                // For TTY mode, output comes as raw text
                // For non-TTY mode, we need to demux
                stream.on('data', (chunk: Buffer) => {
                    // Docker multiplexed stream format
                    let offset = 0;
                    while (offset < chunk.length) {
                        if (offset + 8 > chunk.length) {
                            // Incomplete header, treat as raw output
                            const text = chunk.slice(offset).toString('utf-8');
                            stdout += text;
                            config?.onOutput?.(text, 'stdout');
                            break;
                        }

                        const streamType = chunk[offset];
                        const size = chunk.readUInt32BE(offset + 4);
                        offset += 8;

                        if (offset + size > chunk.length) {
                            // Incomplete payload, treat as raw
                            const text = chunk.slice(offset - 8).toString('utf-8');
                            stdout += text;
                            config?.onOutput?.(text, 'stdout');
                            break;
                        }

                        const payload = chunk.slice(offset, offset + size).toString('utf-8');
                        
                        if (streamType === 2) {
                            stderr += payload;
                            config?.onOutput?.(payload, 'stderr');
                        } else {
                            stdout += payload;
                            config?.onOutput?.(payload, 'stdout');
                        }
                        
                        offset += size;
                    }
                });

                stream.on('end', () => resolve());
                stream.on('error', (err) => reject(err));
            });

            // Get exit code
            const inspectResult = await exec.inspect();
            const exitCode = inspectResult.ExitCode ?? 0;

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
                console.log(`[ProjectContainer] Stopped container ${containerName}`);
            } catch (error: any) {
                if (!error.message?.includes('is not running')) {
                    console.error(`[ProjectContainer] Error stopping container:`, error);
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
                
                console.log(`[ProjectContainer] Removed container ${containerName}`);
            } catch (error: any) {
                console.error(`[ProjectContainer] Error removing container:`, error);
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
