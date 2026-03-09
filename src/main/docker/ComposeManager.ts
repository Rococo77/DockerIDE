import { exec, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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
    private composeBinary: string = 'docker';
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
            const result = require('child_process').execSync('docker compose version', {
                encoding: 'utf-8',
                timeout: 5000,
            });
            if (result.includes('Docker Compose')) {
                this.composeBinary = 'docker';
                return;
            }
        } catch {
            // Try standalone
        }

        try {
            require('child_process').execSync('docker-compose version', {
                encoding: 'utf-8',
                timeout: 5000,
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

        return this.runCompose(projectPath, args);
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
        if (options?.tail) args.push('--tail', String(options.tail));
        if (options?.service) args.push(options.service);

        return this.runCompose(projectPath, args);
    }

    /**
     * Restart a service
     */
    async restart(projectPath: string, service?: string): Promise<ComposeResult> {
        const args = ['restart'];
        if (service) args.push(service);
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
    private runCompose(projectPath: string, args: string[]): Promise<ComposeResult> {
        return new Promise((resolve) => {
            const cmd = this.getComposeCmd();
            const fullArgs = [...cmd.slice(1), ...args];
            const binary = cmd[0];

            const proc = spawn(binary, fullArgs, {
                cwd: projectPath,
                env: { ...process.env },
                shell: true,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output: stdout,
                    error: stderr || undefined,
                });
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    output: '',
                    error: err.message,
                });
            });

            // Timeout after 2 minutes
            setTimeout(() => {
                proc.kill();
                resolve({
                    success: false,
                    output: stdout,
                    error: 'Command timed out',
                });
            }, 120000);
        });
    }

    /**
     * Generate a docker-compose.yml template
     */
    static generateComposeTemplate(type: 'web-db' | 'fullstack' | 'microservices', language: string): string {
        switch (type) {
            case 'web-db':
                return ComposeManager.webDbTemplate(language);
            case 'fullstack':
                return ComposeManager.fullstackTemplate(language);
            default:
                return ComposeManager.webDbTemplate(language);
        }
    }

    private static webDbTemplate(language: string): string {
        const imageMap: Record<string, string> = {
            python: 'python:3.11-alpine',
            javascript: 'node:20-alpine',
            typescript: 'node:20-alpine',
            php: 'php:8.2-cli-alpine',
            ruby: 'ruby:3.2-alpine',
            go: 'golang:1.22-alpine',
            java: 'eclipse-temurin:17-jdk-alpine',
        };

        const image = imageMap[language] || 'node:20-alpine';

        return `services:
  app:
    image: ${image}
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://user:password@db:5432/app

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  db_data:
`;
    }

    private static fullstackTemplate(language: string): string {
        return `services:
  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
    ports:
      - "5173:5173"
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"

  backend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./backend:/app
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://user:password@db:5432/app
    command: sh -c "npm install && npm start"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
`;
    }
}
