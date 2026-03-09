import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import { FileSystemManager } from '../fs/FileSystemManager';
import { handleIpc } from './ipcHelper';

/**
 * Validate that a string is a valid file path and does not contain
 * null bytes or other dangerous patterns.
 */
function sanitizePath(inputPath: string): string {
    if (typeof inputPath !== 'string' || inputPath.length === 0) {
        throw new Error('Invalid path: must be a non-empty string');
    }
    if (inputPath.includes('\0')) {
        throw new Error('Invalid path: contains null bytes');
    }
    return path.normalize(inputPath);
}

export function registerFileSystemHandlers(): void {
    const fsManager = FileSystemManager.getInstance();

    console.log('[FileSystem] Registering file system IPC handlers...');

    // Open folder dialog - special case, needs dialog API
    ipcMain.handle('fs:open-folder', async () => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Ouvrir un dossier de projet'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];
            fsManager.setWorkspace(folderPath);
            return { success: true, path: folderPath };
        }
        return { success: false, path: null };
    });

    handleIpc('fs:get-workspace', () => fsManager.getWorkspace());

    handleIpc('fs:set-workspace', (workspacePath: string) => {
        fsManager.setWorkspace(workspacePath);
        return { success: true };
    });

    handleIpc('fs:read-directory', async (dirPath: string, depth?: number) => {
        const files = await fsManager.readDirectory(sanitizePath(dirPath), depth);
        return { success: true, files };
    });

    handleIpc('fs:read-file', async (filePath: string) => {
        const fileContent = await fsManager.readFile(sanitizePath(filePath));
        return { success: true, ...fileContent };
    });

    handleIpc('fs:write-file', async (filePath: string, content: string) => {
        await fsManager.writeFile(sanitizePath(filePath), content);
        return { success: true };
    });

    handleIpc('fs:create-file', async (filePath: string, content?: string) => {
        await fsManager.createFile(sanitizePath(filePath), content);
        return { success: true };
    });

    handleIpc('fs:create-directory', async (dirPath: string) => {
        await fsManager.createDirectory(sanitizePath(dirPath));
        return { success: true };
    });

    handleIpc('fs:delete', async (itemPath: string) => {
        await fsManager.delete(sanitizePath(itemPath));
        return { success: true };
    });

    handleIpc('fs:rename', async (oldPath: string, newPath: string) => {
        await fsManager.rename(sanitizePath(oldPath), sanitizePath(newPath));
        return { success: true };
    });

    handleIpc('fs:exists', async (itemPath: string) => {
        const exists = await fsManager.exists(sanitizePath(itemPath));
        return { success: true, exists };
    });

    handleIpc('fs:get-language', (filePath: string) => {
        const language = fsManager.getLanguageFromExtension(filePath);
        return { language };
    });

    handleIpc('fs:get-docker-image', (language: string) => {
        const image = fsManager.getDockerImageForLanguage(language);
        return { image };
    });

    console.log('[FileSystem] File system IPC handlers registered');
}
