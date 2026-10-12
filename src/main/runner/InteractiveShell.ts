import Docker from 'dockerode';
import { EventEmitter } from 'events';
import * as path from 'path';
import { DockerManager } from '../docker/DockerManager';
import { ImageManager } from '../docker/ImageManager';
import log from '../logger';
import { withDependencies } from './ProjectEnvironment';

interface ShellConfig {
    image: string;
    workspacePath?: string;
    language?: string;
    // The project's terminal: a shell (not a language REPL) with the project's dependencies
    project?: boolean;
    // Ports of the project's server, published on this machine
    ports?: number[];
}

interface ShellMessage {
    type: 'output' | 'error' | 'system';
    data: string;
}

// Default shells for different languages
const LANGUAGE_SHELLS: Record<string, { image: string; shell: string[] }> = {
    python: { image: 'python:3.11-slim', shell: ['python'] },
    javascript: { image: 'node:20-alpine', shell: ['node'] },
    ruby: { image: 'ruby:3.2-slim', shell: ['irb'] },
    php: { image: 'php:8.2-cli', shell: ['php', '-a'] },
    bash: { image: 'alpine:latest', shell: ['/bin/sh'] },
    default: { image: 'alpine:latest', shell: ['/bin/sh'] },
};

export class InteractiveShell extends EventEmitter {
    private container: Docker.Container | null = null;
    private outputStream: NodeJS.ReadWriteStream | null = null;
    private isRunning = false;
    private containerId: string | null = null;
    private containerName: string | null = null;
    private closed = false;
    private publishedPorts: number[] = [];

    // The client shared with the other managers, looked up on each call
    private get docker(): Docker {
        return DockerManager.getInstance().getDockerInstance();
    }

    /**
     * Start an interactive shell in a Docker container
     */
    async start(config: ShellConfig): Promise<boolean> {
        try {
            const shellConfig = config.language && !config.project
                ? LANGUAGE_SHELLS[config.language] || LANGUAGE_SHELLS.default
                : LANGUAGE_SHELLS.default;

            const imageName = config.image || shellConfig.image;

            // Emit status
            this.emit('message', { 
                type: 'system', 
                data: `Starting interactive shell (${imageName})...` 
            } as ShellMessage);

            // Check if image exists
            const imageManager = ImageManager.getInstance();
            if (!(await imageManager.hasImage(imageName))) {
                this.emit('message', {
                    type: 'system',
                    data: `Downloading image ${imageName}...`
                } as ShellMessage);
                await imageManager.pullImage(imageName);
            }

            // Create container - name based on project folder
            const projectName = config.workspacePath 
                ? path.basename(config.workspacePath).toLowerCase().replace(/[^a-z0-9-]/g, '-')
                : 'shell';
            // With the project mounted, the shell sees its dependencies (Python virtualenv,
            // Ruby gems); the project terminal creates the virtualenv if needed
            const cmd = config.workspacePath
                ? withDependencies(imageName, shellConfig.shell, config.project)
                : shellConfig.shell;
            const createShellContainer = (ports: number[]) => {
                const containerName = `docker-ide-${projectName}-${Date.now()}`;
                this.containerName = containerName;
                return this.docker.createContainer({
                    Image: imageName,
                    name: containerName,
                    Cmd: cmd,
                    WorkingDir: config.workspacePath ? '/workspace' : '/',
                    Tty: true,
                    OpenStdin: true,
                    // Close stdin when the IDE detaches (app closed or crashed): the shell then
                    // exits and AutoRemove deletes the container instead of leaving it running
                    StdinOnce: true,
                    ExposedPorts: Object.fromEntries(ports.map((port) => [`${port}/tcp`, {}])),
                    HostConfig: {
                        AutoRemove: true,
                        Binds: config.workspacePath ? [`${config.workspacePath}:/workspace`] : undefined,
                        // So that the server started in the terminal opens in the browser. Bound
                        // to this machine only: it isn't exposed to the network.
                        PortBindings: Object.fromEntries(ports.map((port) => [
                            `${port}/tcp`, [{ HostIp: '127.0.0.1', HostPort: String(port) }],
                        ])),
                    },
                });
            };

            const ports = config.ports ?? [];
            this.container = await createShellContainer(ports);
            this.containerId = this.container.id;

            // Start container
            try {
                await this.container.start();
                this.publishedPorts = ports;
            } catch (error) {
                if (ports.length === 0) throw error;
                // Usually a port already used on this machine (another server, another
                // project's terminal): start the shell anyway, without publishing them
                await this.container.remove({ force: true }).catch((): void => undefined);
                this.container = await createShellContainer([]);
                this.containerId = this.container.id;
                await this.container.start();
                this.publishedPorts = [];
                this.emit('message', {
                    type: 'system',
                    data: `Port ${ports.join(', ')} unavailable on this computer: the project's server won't open in the browser.`,
                } as ShellMessage);
            }
            this.isRunning = true;

            // Attach to container
            this.outputStream = await this.attachToShell(this.container);

            // Handle output - for TTY mode, data comes as raw text
            this.outputStream.on('data', (chunk: Buffer) => {
                const text = chunk.toString('utf8');
                // Clean up control sequences but keep readable output
                const cleanText = text
                    // eslint-disable-next-line no-control-regex
                    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape codes
                    // eslint-disable-next-line no-control-regex
                    .replace(/\x1b\][^\x07]*\x07/g, '') // Remove OSC sequences
                    // eslint-disable-next-line no-control-regex
                    .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '') // Remove other escape sequences
                    // eslint-disable-next-line no-control-regex
                    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except newline/tab
                    .trim();
                
                // Skip empty lines. (The attach options used to be echoed here; filtering every
                // chunk containing "stdout", "stream"... also hid legitimate output.)
                if (cleanText.length > 0) {
                    this.emit('message', { type: 'output', data: cleanText } as ShellMessage);
                }
            });

            this.outputStream.on('end', () => this.markClosed());

            this.outputStream.on('error', (err) => {
                this.emit('message', { type: 'error', data: err.message } as ShellMessage);
            });

            // Wait for container to exit
            this.container.wait().then(() => this.markClosed()).catch(() => {
                this.isRunning = false;
            });

            this.emit('message', { 
                type: 'system', 
                data: 'Shell ready. Type your commands.' 
            } as ShellMessage);

            return true;
        } catch (error: any) {
            this.emit('message', { 
                type: 'error', 
                data: `Erreur: ${error.message}` 
            } as ShellMessage);
            return false;
        }
    }

    /**
     * Attach to the shell's stdin/stdout. Not with container.attach(): docker-modem sends the
     * attach options as a JSON request body, which Docker can pass on to the shell's stdin,
     * corrupting the first command typed (`{"stream":true,...}ls`). Here the options go in the
     * query string and the body is empty; writing it still makes Node send the headers.
     */
    private attachToShell(container: Docker.Container): Promise<NodeJS.ReadWriteStream> {
        return new Promise((resolve, reject) => {
            this.docker.modem.dial({
                path: `/containers/${container.id}/attach?`,
                method: 'POST',
                options: { stream: true, stdin: true, stdout: true, stderr: true },
                file: Buffer.alloc(0),
                isStream: true,
                hijack: true,
                openStdin: true,
                statusCodes: { 101: true, 200: true, 404: 'no such container', 500: 'server error' },
            }, (err: Error | null, stream: NodeJS.ReadWriteStream) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stream);
                }
            });
        });
    }

    /**
     * Send input to the shell
     */
    write(data: string): void {
        if (this.outputStream && this.isRunning) {
            this.outputStream.write(data);
        }
    }

    /**
     * Send a line of input (with newline)
     */
    writeLine(data: string): void {
        this.write(data + '\n');
    }

    /**
     * Resize the terminal
     */
    async resize(cols: number, rows: number): Promise<void> {
        if (this.container && this.isRunning) {
            try {
                await this.container.resize({ w: cols, h: rows });
            } catch (err) {
                log.error('Error resizing terminal:', err);
            }
        }
    }

    /**
     * Stop the shell and container
     */
    async stop(): Promise<void> {
        this.isRunning = false;

        if (this.outputStream) {
            this.outputStream.end();
            this.outputStream = null;
        }

        if (this.container) {
            try {
                await this.container.stop({ t: 1 });
            } catch (err) {
                // Container might already be stopped
            }
            try {
                await this.container.remove({ force: true });
            } catch (err) {
                // Container might already be removed
            }
            this.container = null;
        }

        this.markClosed();
    }

    // The stream end, the container exit and stop() all mean the same thing: report it once
    // (the terminal used to print "Shell closed" up to three times)
    private markClosed(): void {
        this.isRunning = false;
        if (this.closed) return;
        this.closed = true;
        this.emit('close');
    }

    /**
     * Check if shell is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Ports of the project's server published on this machine
     */
    getPublishedPorts(): number[] {
        return this.publishedPorts;
    }

    /**
     * Get container ID
     */
    getContainerId(): string | null {
        return this.containerId;
    }

    /**
     * Get container name
     */
    getContainerName(): string | null {
        return this.containerName;
    }
}

// Shell Manager to handle multiple shells
export class ShellManager {
    private static instance: ShellManager;
    private shells: Map<string, InteractiveShell> = new Map();

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    static getInstance(): ShellManager {
        if (!ShellManager.instance) {
            ShellManager.instance = new ShellManager();
        }
        return ShellManager.instance;
    }

    /**
     * Create a new shell
     */
    createShell(id: string): InteractiveShell {
        const shell = new InteractiveShell();
        this.shells.set(id, shell);
        
        // Clean up on close
        shell.on('close', () => {
            this.shells.delete(id);
        });

        return shell;
    }

    /**
     * Get a shell by ID
     */
    getShell(id: string): InteractiveShell | undefined {
        return this.shells.get(id);
    }

    /**
     * Stop a shell
     */
    async stopShell(id: string): Promise<void> {
        const shell = this.shells.get(id);
        if (shell) {
            await shell.stop();
            this.shells.delete(id);
        }
    }

    /**
     * Stop all shells
     */
    async stopAll(): Promise<void> {
        for (const [id, shell] of this.shells) {
            await shell.stop();
        }
        this.shells.clear();
    }

    /**
     * Get all active shell IDs
     */
    getActiveShells(): string[] {
        return Array.from(this.shells.keys());
    }
}
