import * as fs from 'fs';
import * as path from 'path';
import log from '../logger';

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileNode[];
    extension?: string;
}

export interface FileContent {
    path: string;
    content: string;
    encoding?: string;
}

export class FileSystemManager {
    private static instance: FileSystemManager;
    private currentWorkspace: string | null = null;

    private constructor() {}

    static getInstance(): FileSystemManager {
        if (!FileSystemManager.instance) {
            FileSystemManager.instance = new FileSystemManager();
        }
        return FileSystemManager.instance;
    }

    /**
     * Set the current workspace directory
     */
    setWorkspace(workspacePath: string): void {
        if (fs.existsSync(workspacePath) && fs.statSync(workspacePath).isDirectory()) {
            this.currentWorkspace = workspacePath;
        } else {
            throw new Error(`Invalid workspace path: ${workspacePath}`);
        }
    }

    /**
     * Get the current workspace
     */
    getWorkspace(): string | null {
        return this.currentWorkspace;
    }

    private assertInWorkspace(inputPath: string): string {
        if (!this.currentWorkspace) throw new Error('No workspace set');
        const resolved = path.resolve(inputPath);
        const workspace = path.resolve(this.currentWorkspace);
        if (resolved !== workspace && !resolved.startsWith(workspace + path.sep)) {
            throw new Error('Access denied: path outside workspace');
        }
        return resolved;
    }

    /**
     * Read directory contents and return tree structure
     */
    async readDirectory(dirPath: string, depth: number = 3): Promise<FileNode[]> {
        const safePath = this.assertInWorkspace(dirPath);
        const result: FileNode[] = [];

        try {
            const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
            
            // Sort: directories first, then files, alphabetically
            entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of entries) {
                // Skip hidden files and common ignored directories
                if (entry.name.startsWith('.') || 
                    entry.name === 'node_modules' || 
                    entry.name === '__pycache__' ||
                    entry.name === 'venv' ||
                    entry.name === '.git') {
                    continue;
                }

                const fullPath = path.join(safePath, entry.name);
                const node: FileNode = {
                    name: entry.name,
                    path: fullPath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined
                };

                // Recursively read subdirectories if depth allows
                if (entry.isDirectory() && depth > 0) {
                    node.children = await this.readDirectory(fullPath, depth - 1);
                }

                result.push(node);
            }
        } catch (error) {
            log.error(`Error reading directory ${safePath}:`, error);
            throw error;
        }

        return result;
    }

    /**
     * Read file content
     */
    async readFile(filePath: string): Promise<FileContent> {
        const safePath = this.assertInWorkspace(filePath);
        try {
            const content = await fs.promises.readFile(safePath, 'utf-8');
            return {
                path: safePath,
                content,
                encoding: 'utf-8'
            };
        } catch (error) {
            log.error(`Error reading file ${safePath}:`, error);
            throw error;
        }
    }

    /**
     * Write file content
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        const safePath = this.assertInWorkspace(filePath);
        try {
            const dir = path.dirname(safePath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(safePath, content, 'utf-8');
        } catch (error) {
            log.error(`Error writing file ${safePath}:`, error);
            throw error;
        }
    }

    /**
     * Create a new file
     */
    async createFile(filePath: string, content: string = ''): Promise<void> {
        const safePath = this.assertInWorkspace(filePath);
        if (fs.existsSync(safePath)) {
            throw new Error(`File already exists: ${safePath}`);
        }
        await this.writeFile(safePath, content);
    }

    /**
     * Create a new directory
     */
    async createDirectory(dirPath: string): Promise<void> {
        const safePath = this.assertInWorkspace(dirPath);
        try {
            await fs.promises.mkdir(safePath, { recursive: true });
        } catch (error) {
            log.error(`Error creating directory ${safePath}:`, error);
            throw error;
        }
    }

    /**
     * Delete a file or directory
     */
    async delete(itemPath: string): Promise<void> {
        const safePath = this.assertInWorkspace(itemPath);
        try {
            const stat = await fs.promises.stat(safePath);
            if (stat.isDirectory()) {
                await fs.promises.rm(safePath, { recursive: true });
            } else {
                await fs.promises.unlink(safePath);
            }
        } catch (error) {
            log.error(`Error deleting ${safePath}:`, error);
            throw error;
        }
    }

    /**
     * Rename a file or directory
     */
    async rename(oldPath: string, newPath: string): Promise<void> {
        const safeOld = this.assertInWorkspace(oldPath);
        const safeNew = this.assertInWorkspace(newPath);
        try {
            await fs.promises.rename(safeOld, safeNew);
        } catch (error) {
            log.error(`Error renaming ${safeOld} to ${safeNew}:`, error);
            throw error;
        }
    }

    /**
     * Check if path exists
     */
    async exists(itemPath: string): Promise<boolean> {
        try {
            await fs.promises.access(itemPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file stats
     */
    async getStats(itemPath: string): Promise<fs.Stats> {
        return fs.promises.stat(itemPath);
    }

    /**
     * Detect language from file extension
     */
    getLanguageFromExtension(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase().slice(1);
        const languageMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'rb': 'ruby',
            'php': 'php',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'sql': 'sql',
            'sh': 'shell',
            'bash': 'shell',
            'ps1': 'powershell',
            'dockerfile': 'dockerfile',
            'makefile': 'makefile',
            'cmake': 'cmake'
        };
        return languageMap[ext] || 'plaintext';
    }

    /**
     * Get Docker image for a language
     */
    getDockerImageForLanguage(language: string): string | null {
        const imageMap: Record<string, string> = {
            'python': 'python:3.11-slim',
            'javascript': 'node:20-alpine',
            'typescript': 'node:20-alpine',
            'java': 'eclipse-temurin:17-jdk',
            'go': 'golang:1.21-alpine',
            'rust': 'rust:1.73-slim',
            'ruby': 'ruby:3.2-slim',
            'php': 'php:8.2-cli',
            'c': 'gcc:13',
            'cpp': 'gcc:13'
        };
        return imageMap[language] || null;
    }
}

export default FileSystemManager;
