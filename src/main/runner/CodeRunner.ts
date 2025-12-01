import { ContainerManager } from '../docker/ContainerManager';
import { ImageManager } from '../docker/ImageManager';
import { FileSystemManager } from '../fs/FileSystemManager';
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

    private constructor() {
        this.containerManager = ContainerManager.getInstance();
        this.imageManager = ImageManager.getInstance();
        this.fsManager = FileSystemManager.getInstance();
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
     * Run code in a Docker container
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

            // Create container configuration
            const containerName = `docker-ide-run-${Date.now()}`;
            onProgress?.('Création du conteneur...');

            const containerConfig = {
                Image: langConfig.image,
                name: containerName,
                Cmd: langConfig.command(containerFilePath),
                WorkingDir: '/workspace',
                HostConfig: {
                    Binds: [`${workspacePath}:/workspace:ro`],
                    AutoRemove: true,
                    NetworkMode: 'none', // No network for security
                    Memory: 256 * 1024 * 1024, // 256MB limit
                    MemorySwap: 256 * 1024 * 1024,
                    CpuPeriod: 100000,
                    CpuQuota: 50000, // 50% CPU
                },
                Tty: false,
                AttachStdout: true,
                AttachStderr: true,
            };

            // Create and run container
            onProgress?.('Exécution du code...');
            const container = await this.containerManager.createContainer(containerConfig);
            
            // Collect output
            let stdout = '';
            let stderr = '';
            
            const stream = await container.attach({
                stream: true,
                stdout: true,
                stderr: true,
            });

            // Parse Docker multiplexed stream
            stream.on('data', (chunk: Buffer) => {
                // Docker stream format: [header(8 bytes)][payload]
                // header[0] = stream type (1=stdout, 2=stderr)
                // header[4-7] = payload size
                let offset = 0;
                while (offset < chunk.length) {
                    if (offset + 8 > chunk.length) break;
                    
                    const streamType = chunk[offset];
                    const size = chunk.readUInt32BE(offset + 4);
                    offset += 8;
                    
                    if (offset + size > chunk.length) break;
                    
                    const payload = chunk.slice(offset, offset + size).toString('utf-8');
                    if (streamType === 1) {
                        stdout += payload;
                    } else if (streamType === 2) {
                        stderr += payload;
                    }
                    offset += size;
                }
            });

            await container.start();

            // Wait for container to finish (with timeout)
            const result = await Promise.race([
                container.wait(),
                new Promise<{ StatusCode: number }>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 30000)
                ),
            ]);

            const executionTime = Date.now() - startTime;

            return {
                success: result.StatusCode === 0,
                output: stdout,
                error: stderr || undefined,
                exitCode: result.StatusCode,
                executionTime,
            };

        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            
            if (error.message === 'Timeout') {
                return {
                    success: false,
                    output: '',
                    error: 'Exécution interrompue: temps limite dépassé (30s)',
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
     * Get supported languages
     */
    getSupportedLanguages(): string[] {
        return Object.keys(LANGUAGE_CONFIGS);
    }
}

export default CodeRunner;
