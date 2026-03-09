import { ContainerManager } from '../docker/ContainerManager';
import { ImageManager } from '../docker/ImageManager';
import { FileSystemManager } from '../fs/FileSystemManager';
import { ProjectContainerManager } from './ProjectContainer';
import * as path from 'path';

interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode?: number;
    executionTime?: number;
}

interface RunConfig {
    filePath: string;
    workspacePath: string;
    language: string;
}

// Mapping des langages vers les configurations Docker
// Language configs with optimized images (alpine/slim variants to reduce pull size)
const LANGUAGE_CONFIGS: Record<string, {
    image: string;
    command: (filePath: string) => string[];
    fileExtensions: string[];
    // Optimized Dockerfile template for production builds
    dockerfile?: (entryFile: string) => string;
}> = {
    python: {
        image: 'python:3.11-alpine',
        command: (file) => ['python', file],
        fileExtensions: ['py'],
        dockerfile: (entry) => `FROM python:3.11-alpine AS base
WORKDIR /app
COPY requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
COPY . .
CMD ["python", "${entry}"]`,
    },
    javascript: {
        image: 'node:20-alpine',
        command: (file) => ['node', file],
        fileExtensions: ['js', 'mjs'],
        dockerfile: (entry) => `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production 2>/dev/null || true
COPY . .
CMD ["node", "${entry}"]`,
    },
    typescript: {
        image: 'node:20-alpine',
        command: (file) => ['npx', 'ts-node', file],
        fileExtensions: ['ts'],
        dockerfile: (entry) => `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci
COPY . .
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --production
CMD ["node", "dist/${entry.replace('.ts', '.js')}"]`,
    },
    java: {
        image: 'eclipse-temurin:17-jdk-alpine',
        command: (file) => {
            const className = path.basename(file, '.java');
            return ['sh', '-c', `javac ${file} && java -cp $(dirname ${file}) ${className}`];
        },
        fileExtensions: ['java'],
        dockerfile: (entry) => {
            const className = path.basename(entry, '.java');
            return `FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN javac ${entry}

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/*.class .
CMD ["java", "${className}"]`;
        },
    },
    go: {
        image: 'golang:1.22-alpine',
        command: (file) => ['go', 'run', file],
        fileExtensions: ['go'],
        dockerfile: (entry) => `FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/main ${entry}

FROM scratch
COPY --from=build /app/main /main
ENTRYPOINT ["/main"]`,
    },
    rust: {
        image: 'rust:1.75-alpine',
        command: (file) => {
            const outputName = path.basename(file, '.rs');
            return ['sh', '-c', `rustc ${file} -o /tmp/${outputName} && /tmp/${outputName}`];
        },
        fileExtensions: ['rs'],
        dockerfile: (entry) => `FROM rust:1.75-alpine AS build
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY . .
RUN cargo build --release 2>/dev/null || rustc -O ${entry} -o /app/main

FROM alpine:3.19
COPY --from=build /app/target/release/* /app/main* /usr/local/bin/
ENTRYPOINT ["main"]`,
    },
    ruby: {
        image: 'ruby:3.2-alpine',
        command: (file) => ['ruby', file],
        fileExtensions: ['rb'],
        dockerfile: (entry) => `FROM ruby:3.2-alpine
WORKDIR /app
COPY Gemfile* ./
RUN bundle install 2>/dev/null || true
COPY . .
CMD ["ruby", "${entry}"]`,
    },
    php: {
        image: 'php:8.2-cli-alpine',
        command: (file) => ['php', file],
        fileExtensions: ['php'],
        dockerfile: (entry) => `FROM php:8.2-cli-alpine
WORKDIR /app
COPY . .
CMD ["php", "${entry}"]`,
    },
    c: {
        image: 'alpine:3.19',
        command: (file) => {
            const outputName = path.basename(file, '.c');
            return ['sh', '-c', `gcc ${file} -o /tmp/${outputName} -static && /tmp/${outputName}`];
        },
        fileExtensions: ['c'],
        dockerfile: (entry) => {
            const outputName = path.basename(entry, '.c');
            return `FROM alpine:3.19 AS build
RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY . .
RUN gcc -O2 -static ${entry} -o ${outputName}

FROM scratch
COPY --from=build /app/${outputName} /${outputName}
ENTRYPOINT ["/${outputName}"]`;
        },
    },
    cpp: {
        image: 'alpine:3.19',
        command: (file) => {
            const outputName = path.basename(file, '.cpp');
            return ['sh', '-c', `g++ ${file} -o /tmp/${outputName} -static && /tmp/${outputName}`];
        },
        fileExtensions: ['cpp', 'cc', 'cxx'],
        dockerfile: (entry) => {
            const outputName = path.basename(entry, '.cpp');
            return `FROM alpine:3.19 AS build
RUN apk add --no-cache g++ musl-dev
WORKDIR /app
COPY . .
RUN g++ -O2 -static ${entry} -o ${outputName}

FROM scratch
COPY --from=build /app/${outputName} /${outputName}
ENTRYPOINT ["/${outputName}"]`;
        },
    },
};

export class CodeRunner {
    private static instance: CodeRunner;
    private containerManager: ContainerManager;
    private imageManager: ImageManager;
    private fsManager: FileSystemManager;
    private projectContainerManager: ProjectContainerManager;

    private constructor() {
        this.containerManager = ContainerManager.getInstance();
        this.imageManager = ImageManager.getInstance();
        this.fsManager = FileSystemManager.getInstance();
        this.projectContainerManager = ProjectContainerManager.getInstance();
    }

    static getInstance(): CodeRunner {
        if (!CodeRunner.instance) {
            CodeRunner.instance = new CodeRunner();
        }
        return CodeRunner.instance;
    }

    /**
     * Get the language configuration
     */
    getLanguageConfig(language: string) {
        return LANGUAGE_CONFIGS[language] || null;
    }

    /**
     * Check if an image is available locally
     */
    async isImageAvailable(imageName: string): Promise<boolean> {
        try {
            const images = await this.imageManager.listImages();
            return images.some(img => 
                img.RepoTags?.some(tag => tag === imageName || tag.startsWith(imageName.split(':')[0]))
            );
        } catch {
            return false;
        }
    }

    /**
     * Pull an image if not available
     */
    async ensureImage(imageName: string, onProgress?: (status: string) => void): Promise<boolean> {
        try {
            const available = await this.isImageAvailable(imageName);
            if (available) {
                return true;
            }

            onProgress?.(`Downloading image ${imageName}...`);
            await this.imageManager.pullImage(imageName);
            onProgress?.(`Image ${imageName} ready`);
            return true;
        } catch (error: any) {
            console.error('Error ensuring image:', error);
            return false;
        }
    }

    /**
     * Run code in a persistent Docker container for the project
     * Uses exec to run commands in an existing container instead of creating new ones
     */
    async runCode(config: RunConfig, onProgress?: (status: string) => void): Promise<ExecutionResult> {
        const { filePath, workspacePath, language } = config;
        const langConfig = this.getLanguageConfig(language);

        if (!langConfig) {
            return {
                success: false,
                output: '',
                error: `Langage non supporté: ${language}`,
            };
        }

        const startTime = Date.now();

        try {
            // Ensure image is available
            onProgress?.(`Vérification de l'image ${langConfig.image}...`);
            const imageReady = await this.ensureImage(langConfig.image, onProgress);
            if (!imageReady) {
                return {
                    success: false,
                    output: '',
                    error: `Impossible de télécharger l'image ${langConfig.image}`,
                };
            }

            // Get relative path for container
            const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, '/');
            const containerFilePath = `/workspace/${relativePath}`;

            // Get command for the language
            const command = langConfig.command(containerFilePath);
            
            // Check if container already exists for this project
            const existingContainer = this.projectContainerManager.getContainerInfo(workspacePath);
            if (existingContainer) {
                onProgress?.(`Reusing container ${existingContainer.name}...`);
            } else {
                onProgress?.('Creating persistent container...');
            }

            // Execute in persistent container
            onProgress?.('Running code...');
            const result = await this.projectContainerManager.exec(
                workspacePath,
                ['sh', '-c', command.join(' ')],
                {
                    image: langConfig.image,
                    language,
                    onOutput: (data, type) => {
                        // Could stream output here if needed
                    },
                }
            );

            return {
                success: result.success,
                output: result.output,
                error: result.error,
                exitCode: result.exitCode,
                executionTime: result.executionTime,
            };

        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            
            return {
                success: false,
                output: '',
                error: error.message || 'Unknown error',
                executionTime,
            };
        }
    }

    /**
     * Get supported languages
     */
    getSupportedLanguages(): string[] {
        return Object.keys(LANGUAGE_CONFIGS);
    }

    /**
     * Generate an optimized multi-stage Dockerfile for a project
     */
    generateDockerfile(language: string, entryFile: string): string | null {
        const config = LANGUAGE_CONFIGS[language];
        if (!config?.dockerfile) return null;
        return config.dockerfile(entryFile);
    }

    /**
     * Run framework setup/installation in a Docker container
     * This runs commands like `composer create-project laravel/laravel .`
     */
    async runFrameworkSetup(
        config: {
            projectPath: string;
            image: string;
            installCommand: string;
            onOutput?: (data: string) => void;
            onProgress?: (status: string) => void;
        }
    ): Promise<ExecutionResult> {
        const { projectPath, image, installCommand, onOutput, onProgress } = config;
        const startTime = Date.now();

        try {
            // Ensure image is available
            onProgress?.(`Downloading image ${image}...`);
            const imageReady = await this.ensureImage(image, onProgress);
            if (!imageReady) {
                return {
                    success: false,
                    output: '',
                    error: `Impossible de télécharger l'image ${image}`,
                };
            }

            const containerName = `docker-ide-setup-${Date.now()}`;
            onProgress?.('Creating setup container...');

            // Create container with network access for package downloads
            const containerConfig = {
                Image: image,
                name: containerName,
                Cmd: ['sh', '-c', installCommand],
                WorkingDir: '/workspace',
                HostConfig: {
                    Binds: [`${projectPath}:/workspace:rw`],
                    AutoRemove: true,
                    NetworkMode: 'bridge', // Need network for package downloads
                    Memory: 1024 * 1024 * 1024, // 1GB limit for framework install
                    MemorySwap: 1024 * 1024 * 1024,
                },
                Tty: true,
                AttachStdout: true,
                AttachStderr: true,
                OpenStdin: false,
            };

            onProgress?.('Installing framework...');
            const container = await this.containerManager.createContainer(containerConfig);

            // Collect output
            let fullOutput = '';

            const stream = await container.attach({
                stream: true,
                stdout: true,
                stderr: true,
            });

            stream.on('data', (chunk: Buffer) => {
                let text = chunk.toString('utf-8');
                // Filter out Docker debug/config output
                text = text
                    .replace(/\{[^}]*"stream"[^}]*\}/g, '') // Remove JSON-like config strings
                    .replace(/\{[^}]*"stdin"[^}]*\}/g, '')
                    .replace(/\{[^}]*"stdout"[^}]*\}/g, '')
                    .replace(/\{[^}]*"stderr"[^}]*\}/g, '')
                    .replace(/\{[^}]*"hijack"[^}]*\}/g, '')
                    .trim();
                if (text.length > 0) {
                    fullOutput += text;
                    onOutput?.(text);
                }
            });

            await container.start();

            // Wait for container to finish (5 min timeout for framework install)
            const result = await Promise.race([
                container.wait(),
                new Promise<{ StatusCode: number }>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 300000) // 5 min
                ),
            ]);

            const executionTime = Date.now() - startTime;

            if (result.StatusCode === 0) {
                onProgress?.('Framework installed successfully');
            } else {
                onProgress?.('Framework installation failed');
            }

            return {
                success: result.StatusCode === 0,
                output: fullOutput,
                exitCode: result.StatusCode,
                executionTime,
            };

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            if (error.message === 'Timeout') {
                return {
                    success: false,
                    output: '',
                    error: 'Installation interrompue: temps limite dépassé (5min)',
                    executionTime,
                };
            }

            return {
                success: false,
                output: '',
                error: error.message || 'Unknown error',
                executionTime,
            };
        }
    }

    /**
     * Get container info for a project
     */
    getProjectContainerInfo(projectPath: string) {
        return this.projectContainerManager.getContainerInfo(projectPath);
    }

    /**
     * Stop project container
     */
    async stopProjectContainer(projectPath: string): Promise<void> {
        await this.projectContainerManager.stopContainer(projectPath);
    }

    /**
     * Remove project container
     */
    async removeProjectContainer(projectPath: string): Promise<void> {
        await this.projectContainerManager.removeContainer(projectPath);
    }

    /**
     * Check if project has a running container
     */
    isProjectContainerRunning(projectPath: string): boolean {
        return this.projectContainerManager.isContainerRunning(projectPath);
    }

    /**
     * List all managed project containers
     */
    listProjectContainers() {
        return this.projectContainerManager.listContainers();
    }

    /**
     * Stop all project containers
     */
    async stopAllProjectContainers(): Promise<void> {
        await this.projectContainerManager.stopAll();
    }
}

export default CodeRunner;
