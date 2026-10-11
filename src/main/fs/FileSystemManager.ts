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

// Same rule as the project creator's name field
const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

/**
 * True if `target` is `root` itself or somewhere below it. path.relative handles
 * filesystem roots ('/', 'D:\') and compares case-insensitively on Windows.
 */
export function isPathInside(root: string, target: string, pathApi: path.PlatformPath = path): boolean {
    const relative = pathApi.relative(root, target);
    return relative === '' || (
        relative !== '..' &&
        !relative.startsWith(`..${pathApi.sep}`) &&
        !pathApi.isAbsolute(relative)
    );
}

export class FileSystemManager {
    private static instance: FileSystemManager;
    private currentWorkspace: string | null = null;
    // Real paths of the folders the renderer may access: folders the user opened through
    // the native dialog, and project folders created through createProject.
    private allowedRoots = new Set<string>();
    // Folder last picked in the project creator's dialog, the only place a project may be created
    private projectParentDirectory: string | null = null;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    static getInstance(): FileSystemManager {
        if (!FileSystemManager.instance) {
            FileSystemManager.instance = new FileSystemManager();
        }
        return FileSystemManager.instance;
    }

    /**
     * Set the current workspace directory. This grants the renderer access to the folder,
     * so it must only be called with a folder the user picked in a native dialog.
     */
    setWorkspace(workspacePath: string): void {
        if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
            throw new Error(`Invalid workspace path: ${workspacePath}`);
        }
        // Native realpath, like fs.promises.realpath used by resolveAllowedPath
        this.allowedRoots.add(fs.realpathSync.native(workspacePath));
        this.currentWorkspace = workspacePath;
    }

    /**
     * Get the current workspace
     */
    getWorkspace(): string | null {
        return this.currentWorkspace;
    }

    /**
     * Remember the folder picked in the project creator's native dialog
     */
    setProjectParentDirectory(dirPath: string): void {
        this.projectParentDirectory = path.resolve(dirPath);
    }

    /**
     * Create `<parentDir>/<name>` for a new project and grant access to it. The parent must be
     * the folder picked in the dialog, and the project folder must be new or empty so that
     * existing files are never overwritten.
     */
    async createProject(parentDir: string, name: string): Promise<string> {
        if (!this.projectParentDirectory || typeof parentDir !== 'string'
            || path.resolve(parentDir) !== this.projectParentDirectory) {
            throw new Error('Access denied: pick the project location with the folder dialog');
        }
        if (typeof name !== 'string' || !PROJECT_NAME_PATTERN.test(name)) {
            throw new Error(`Invalid project name: ${name}`);
        }

        const projectPath = path.join(this.projectParentDirectory, name);
        try {
            await fs.promises.mkdir(projectPath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            const stats = await fs.promises.lstat(projectPath);
            if (!stats.isDirectory() || (await fs.promises.readdir(projectPath)).length > 0) {
                throw new Error(`Folder already exists and is not empty: ${projectPath}`);
            }
        }

        this.allowedRoots.add(await fs.promises.realpath(projectPath));
        this.currentWorkspace = projectPath;
        return projectPath;
    }

    /**
     * Resolve a path received from the renderer and check that it stays inside an allowed
     * folder once symlinks are followed. Returns the absolute path to operate on.
     */
    async resolveAllowedPath(inputPath: string): Promise<string> {
        if (typeof inputPath !== 'string' || inputPath === '') {
            throw new Error('Invalid path');
        }
        if (this.allowedRoots.size === 0) {
            throw new Error('No workspace set');
        }

        const resolved = path.resolve(inputPath);
        const realPath = await this.realPathOf(resolved);
        for (const root of this.allowedRoots) {
            if (isPathInside(root, realPath)) return resolved;
        }
        log.warn('[FileSystem] Access denied outside workspace:', resolved);
        throw new Error('Access denied: path outside workspace');
    }

    /**
     * Real path of `target` with symlinks followed. For a path that doesn't exist yet,
     * resolve its closest existing ancestor and append the missing segments.
     */
    private async realPathOf(target: string): Promise<string> {
        const missingSegments: string[] = [];
        let current = target;
        for (;;) {
            try {
                const realPath = await fs.promises.realpath(current);
                return path.join(realPath, ...missingSegments.reverse());
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                // A symlink to a missing target: writing through it would create a file
                // wherever it points, which can't be checked, so it is refused.
                if (await this.isSymbolicLink(current)) {
                    throw new Error('Access denied: broken symbolic link');
                }
                const parent = path.dirname(current);
                if (parent === current) throw error;
                missingSegments.push(path.basename(current));
                current = parent;
            }
        }
    }

    private async isSymbolicLink(target: string): Promise<boolean> {
        try {
            return (await fs.promises.lstat(target)).isSymbolicLink();
        } catch {
            return false;
        }
    }

    /**
     * Read directory contents and return tree structure
     */
    async readDirectory(dirPath: string, depth = 3): Promise<FileNode[]> {
        const safePath = await this.resolveAllowedPath(dirPath);
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
        const safePath = await this.resolveAllowedPath(filePath);
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
        const safePath = await this.resolveAllowedPath(filePath);
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
    async createFile(filePath: string, content = ''): Promise<void> {
        const safePath = await this.resolveAllowedPath(filePath);
        if (fs.existsSync(safePath)) {
            throw new Error(`File already exists: ${safePath}`);
        }
        await this.writeFile(safePath, content);
    }

    /**
     * Create a new directory
     */
    async createDirectory(dirPath: string): Promise<void> {
        const safePath = await this.resolveAllowedPath(dirPath);
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
        const safePath = await this.resolveAllowedPath(itemPath);
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
        const safeOld = await this.resolveAllowedPath(oldPath);
        const safeNew = await this.resolveAllowedPath(newPath);
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
        const safePath = await this.resolveAllowedPath(itemPath);
        try {
            await fs.promises.access(safePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file stats
     */
    async getStats(itemPath: string): Promise<fs.Stats> {
        const safePath = await this.resolveAllowedPath(itemPath);
        return fs.promises.stat(safePath);
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
