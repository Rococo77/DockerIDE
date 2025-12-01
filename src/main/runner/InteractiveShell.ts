import Docker from 'dockerode';
import { EventEmitter } from 'events';
import * as stream from 'stream';

interface ShellConfig {
    image: string;
    workspacePath?: string;
    language?: string;
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
    private docker: Docker;
    private container: Docker.Container | null = null;
    private execInstance: Docker.Exec | null = null;
    private outputStream: stream.Duplex | null = null;
    private isRunning = false;
    private containerId: string | null = null;

    constructor() {
        super();
        this.docker = new Docker();
    }

    /**
     * Start an interactive shell in a Docker container
     */
    async start(config: ShellConfig): Promise<boolean> {
        try {
            const shellConfig = config.language 
                ? LANGUAGE_SHELLS[config.language] || LANGUAGE_SHELLS.default
                : LANGUAGE_SHELLS.default;

            const imageName = config.image || shellConfig.image;

            // Emit status
            this.emit('message', { 
                type: 'system', 
                data: `🐳 Démarrage du shell interactif (${imageName})...` 
            } as ShellMessage);

            // Check if image exists
            try {
                await this.docker.getImage(imageName).inspect();
            } catch {
                this.emit('message', { 
                    type: 'system', 
                    data: `📥 Téléchargement de l'image ${imageName}...` 
                } as ShellMessage);

                // Pull image
                await new Promise<void>((resolve, reject) => {
                    this.docker.pull(imageName, (err: any, stream: NodeJS.ReadableStream) => {
                        if (err) return reject(err);
                        this.docker.modem.followProgress(stream, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            }

            // Create container
            const containerName = `docker-ide-shell-${Date.now()}`;
            const hostConfig: Docker.HostConfig = {
                AutoRemove: true,
            };

            // Mount workspace if provided
            if (config.workspacePath) {
                hostConfig.Binds = [`${config.workspacePath}:/workspace`];
            }

            this.container = await this.docker.createContainer({
                Image: imageName,
                name: containerName,
                Cmd: shellConfig.shell,
                WorkingDir: config.workspacePath ? '/workspace' : '/',
                Tty: true,
                OpenStdin: true,
                StdinOnce: false,
                HostConfig: hostConfig,
            });

            this.containerId = this.container.id;

            // Start container
            await this.container.start();
            this.isRunning = true;

            // Attach to container
            this.outputStream = await this.container.attach({
                stream: true,
                stdin: true,
                stdout: true,
                stderr: true,
            });

            // Handle output
            this.outputStream.on('data', (chunk: Buffer) => {
                const text = chunk.toString('utf8');
                // Remove control characters that are not printable
                const cleanText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
                if (cleanText.trim()) {
                    this.emit('message', { type: 'output', data: cleanText } as ShellMessage);
                }
            });

            this.outputStream.on('end', () => {
                this.emit('message', { type: 'system', data: '🔌 Shell fermé' } as ShellMessage);
                this.emit('close');
                this.isRunning = false;
            });

            this.outputStream.on('error', (err) => {
                this.emit('message', { type: 'error', data: err.message } as ShellMessage);
            });

            // Wait for container to exit
            this.container.wait().then(() => {
                this.isRunning = false;
                this.emit('close');
            }).catch(() => {
                this.isRunning = false;
            });

            this.emit('message', { 
                type: 'system', 
                data: '✓ Shell prêt. Tapez vos commandes.' 
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
                console.error('Error resizing terminal:', err);
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

        this.emit('close');
    }

    /**
     * Check if shell is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get container ID
     */
    getContainerId(): string | null {
        return this.containerId;
    }
}

// Shell Manager to handle multiple shells
export class ShellManager {
    private static instance: ShellManager;
    private shells: Map<string, InteractiveShell> = new Map();

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
