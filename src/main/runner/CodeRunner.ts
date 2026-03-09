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
const LANGUAGE_CONFIGS: Record<string, {
    image: string;
    command: (filePath: string) => string[];
    fileExtensions: string[];
}> = {
    python: {
        image: 'python:3.11-slim',
        command: (file) => ['python', file],
        fileExtensions: ['py'],
    },
    javascript: {
        image: 'node:20-alpine',
        command: (file) => ['node', file],
        fileExtensions: ['js', 'mjs'],
    },
    typescript: {
        image: 'node:20-alpine',
        command: (file) => ['npx', 'ts-node', file],
        fileExtensions: ['ts'],
    },
    java: {
        image: 'eclipse-temurin:17-jdk',
        command: (file) => {
            const className = path.basename(file, '.java');
            return ['sh', '-c', `javac ${file} && java ${className}`];
        },
        fileExtensions: ['java'],
    },
    go: {
        image: 'golang:1.21-alpine',
        command: (file) => ['go', 'run', file],
        fileExtensions: ['go'],
    },
    rust: {
        image: 'rust:1.73-slim',
        command: (file) => {
            const outputName = path.basename(file, '.rs');
            return ['sh', '-c', `rustc ${file} -o /tmp/${outputName} && /tmp/${outputName}`];
        },
        fileExtensions: ['rs'],
    },
    ruby: {
        image: 'ruby:3.2-slim',
        command: (file) => ['ruby', file],
        fileExtensions: ['rb'],
    },
    php: {
        image: 'php:8.2-cli',
        command: (file) => ['php', file],
        fileExtensions: ['php'],
    },
    c: {
        image: 'gcc:13',
        command: (file) => {
            const outputName = path.basename(file, '.c');
            return ['sh', '-c', `gcc ${file} -o /tmp/${outputName} && /tmp/${outputName}`];
        },
        fileExtensions: ['c'],
    },
    cpp: {
        image: 'gcc:13',
        command: (file) => {
            const outputName = path.basename(file, '.cpp');
            return ['sh', '-c', `g++ ${file} -o /tmp/${outputName} && /tmp/${outputName}`];
        },
        fileExtensions: ['cpp', 'cc', 'cxx'],
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

            onProgress?.(`Téléchargement de l'image ${imageName}...`);
            await this.imageManager.pullImage(imageName);
            onProgress?.(`Image ${imageName} prête`);
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
                onProgress?.(`♻️ Réutilisation du conteneur ${existingContainer.name}...`);
            } else {
                onProgress?.('🐳 Création du conteneur persistant...');
            }

            // Execute in persistent container
            onProgress?.('▶️ Exécution du code...');
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
                error: error.message || 'Erreur inconnue',
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
            onProgress?.(`📦 Téléchargement de l'image ${image}...`);
            const imageReady = await this.ensureImage(image, onProgress);
            if (!imageReady) {
                return {
                    success: false,
                    output: '',
                    error: `Impossible de télécharger l'image ${image}`,
                };
            }

            const containerName = `docker-ide-setup-${Date.now()}`;
            onProgress?.('🐳 Création du conteneur d\'installation...');

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

            onProgress?.('⚙️ Installation du framework en cours...');
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
                onProgress?.('✅ Framework installé avec succès!');
            } else {
                onProgress?.('❌ Erreur lors de l\'installation');
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
                error: error.message || 'Erreur inconnue',
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
