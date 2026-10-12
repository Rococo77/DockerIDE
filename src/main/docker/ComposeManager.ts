import { spawn, execSync, ChildProcess } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Apps launched from the Finder on macOS don't get the shell's PATH (only
// /usr/bin:/bin:/usr/sbin:/sbin), so the docker CLI installed by Docker Desktop
// or Homebrew isn't found. Elsewhere the inherited environment is used as-is.
function dockerCliEnv(): NodeJS.ProcessEnv | undefined {
    if (process.platform !== 'darwin') return undefined;
    const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
    for (const dir of ['/usr/local/bin', '/opt/homebrew/bin', path.join(os.homedir(), '.docker', 'bin'), '/Applications/Docker.app/Contents/Resources/bin']) {
        if (!dirs.includes(dir)) dirs.push(dir);
    }
    return { ...process.env, PATH: dirs.join(path.delimiter) };
}

// `up --build` can build images and pull big ones: give it more time than other commands
const COMPOSE_TIMEOUT_MS = 2 * 60 * 1000;
const COMPOSE_UP_TIMEOUT_MS = 15 * 60 * 1000;

// Compose service names: letters, digits, '.', '_' and '-', never starting with '-'
// so a value coming from the renderer can't be parsed as a CLI option.
const SERVICE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

function assertServiceName(service: string): void {
    if (typeof service !== 'string' || !SERVICE_NAME_PATTERN.test(service)) {
        throw new Error(`Invalid service name: ${service}`);
    }
}

interface ComposeService {
    name: string;
    image?: string;
    build?: string;
    status: 'running' | 'stopped' | 'not_created';
    ports?: string[];
}

interface ComposeProject {
    name: string;
    path: string;
    services: ComposeService[];
    status: 'running' | 'stopped' | 'partial';
}

interface ComposeResult {
    success: boolean;
    output: string;
    error?: string;
}

export class ComposeManager {
    private static instance: ComposeManager;
    private composeBinary = 'docker';
    private activeProcesses: Map<string, ChildProcess> = new Map();

    private constructor() {
        this.detectComposeBinary();
    }

    static getInstance(): ComposeManager {
        if (!ComposeManager.instance) {
            ComposeManager.instance = new ComposeManager();
        }
        return ComposeManager.instance;
    }

    private detectComposeBinary(): void {
        // Modern Docker includes compose as a plugin: `docker compose`
        // Fallback to standalone `docker-compose` if needed
        try {
            const result = execSync('docker compose version', {
                encoding: 'utf-8',
                timeout: 5000,
                env: dockerCliEnv(),
            });
            if (result.includes('Docker Compose')) {
                this.composeBinary = 'docker';
                return;
            }
        } catch {
            // Try standalone
        }

        try {
            execSync('docker-compose version', {
                encoding: 'utf-8',
                timeout: 5000,
                env: dockerCliEnv(),
            });
            this.composeBinary = 'docker-compose';
        } catch {
            // Neither found, will error on use
            this.composeBinary = 'docker';
        }
    }

    private getComposeCmd(): string[] {
        if (this.composeBinary === 'docker') {
            return ['docker', 'compose'];
        }
        return ['docker-compose'];
    }

    /**
     * Check if a compose file exists in the project
     */
    hasComposeFile(projectPath: string): boolean {
        const names = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
        return names.some(name => fs.existsSync(path.join(projectPath, name)));
    }

    /**
     * Get the compose file path
     */
    getComposeFilePath(projectPath: string): string | null {
        const names = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
        for (const name of names) {
            const filePath = path.join(projectPath, name);
            if (fs.existsSync(filePath)) return filePath;
        }
        return null;
    }

    /**
     * Run docker compose up
     */
    async up(projectPath: string, options?: { detach?: boolean; build?: boolean }): Promise<ComposeResult> {
        const args = ['up'];
        if (options?.detach !== false) args.push('-d');
        if (options?.build) args.push('--build');

        return this.runCompose(projectPath, args, COMPOSE_UP_TIMEOUT_MS);
    }

    /**
     * Run docker compose down
     */
    async down(projectPath: string, options?: { removeVolumes?: boolean }): Promise<ComposeResult> {
        const args = ['down'];
        if (options?.removeVolumes) args.push('-v');

        return this.runCompose(projectPath, args);
    }

    /**
     * Get compose project status
     */
    async ps(projectPath: string): Promise<ComposeService[]> {
        const result = await this.runCompose(projectPath, ['ps', '--format', 'json']);
        if (!result.success) return [];

        try {
            const lines = result.output.trim().split('\n').filter(l => l.trim());
            const services: ComposeService[] = [];

            for (const line of lines) {
                try {
                    const svc = JSON.parse(line);
                    services.push({
                        name: svc.Service || svc.Name || 'unknown',
                        image: svc.Image || '',
                        status: svc.State === 'running' ? 'running' : 'stopped',
                        ports: svc.Publishers?.map((p: any) => `${p.PublishedPort}:${p.TargetPort}`) || [],
                    });
                } catch {
                    // Skip non-JSON lines
                }
            }

            return services;
        } catch {
            return [];
        }
    }

    /**
     * Get compose logs
     */
    async logs(projectPath: string, options?: { service?: string; tail?: number }): Promise<ComposeResult> {
        const args = ['logs', '--no-color'];
        if (options?.tail !== undefined) {
            if (!Number.isInteger(options.tail) || options.tail <= 0) {
                throw new Error(`Invalid tail value: ${options.tail}`);
            }
            args.push('--tail', String(options.tail));
        }
        if (options?.service) {
            assertServiceName(options.service);
            args.push(options.service);
        }

        return this.runCompose(projectPath, args);
    }

    /**
     * Restart a service
     */
    async restart(projectPath: string, service?: string): Promise<ComposeResult> {
        const args = ['restart'];
        if (service) {
            assertServiceName(service);
            args.push(service);
        }
        return this.runCompose(projectPath, args);
    }

    /**
     * Stop active compose process for a project
     */
    stopProcess(projectPath: string): void {
        const proc = this.activeProcesses.get(projectPath);
        if (proc) {
            proc.kill();
            this.activeProcesses.delete(projectPath);
        }
    }

    /**
     * Run a compose command
     */
    private runCompose(projectPath: string, args: string[], timeoutMs = COMPOSE_TIMEOUT_MS): Promise<ComposeResult> {
        return new Promise((resolve) => {
            const cmd = this.getComposeCmd();
            const fullArgs = [...cmd.slice(1), ...args];
            const binary = cmd[0];

            // No shell: arguments are passed as-is. The Docker CLI inherits the
            // user's environment (PATH/Path, SystemRoot, DOCKER_CONTEXT, XDG_RUNTIME_DIR...).
            const proc = spawn(binary, fullArgs, { cwd: projectPath, env: dockerCliEnv() });

            let stdout = '';
            let stderr = '';
            let resolved = false;

            const safeResolve = (result: ComposeResult) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(result);
                }
            };

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                safeResolve({
                    success: code === 0,
                    output: stdout,
                    error: stderr || undefined,
                });
            });

            proc.on('error', (err) => {
                safeResolve({
                    success: false,
                    output: '',
                    error: err.message,
                });
            });

            // Timeout (2 minutes, 15 for up)
            const timeout = setTimeout(() => {
                if (!resolved) {
                    proc.kill();
                    safeResolve({
                        success: false,
                        output: stdout,
                        error: 'Command timed out',
                    });
                }
            }, timeoutMs);
        });
    }
}
