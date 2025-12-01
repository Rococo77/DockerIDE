import { ipcMain, dialog, BrowserWindow } from 'electron';
import { FileSystemManager } from '../fs/FileSystemManager';

export function registerFileSystemHandlers(): void {
    const fsManager = FileSystemManager.getInstance();

    console.log('[FileSystem] Registering file system IPC handlers...');

    // Open folder dialog
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

    // Get current workspace
    ipcMain.handle('fs:get-workspace', async () => {
        return fsManager.getWorkspace();
    });

    // Set workspace
    ipcMain.handle('fs:set-workspace', async (_, workspacePath: string) => {
        try {
            fsManager.setWorkspace(workspacePath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Read directory
    ipcMain.handle('fs:read-directory', async (_, dirPath: string, depth?: number) => {
        try {
            const files = await fsManager.readDirectory(dirPath, depth);
            return { success: true, files };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Read file
    ipcMain.handle('fs:read-file', async (_, filePath: string) => {
        try {
            const fileContent = await fsManager.readFile(filePath);
            return { success: true, ...fileContent };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Write file
    ipcMain.handle('fs:write-file', async (_, filePath: string, content: string) => {
        try {
            await fsManager.writeFile(filePath, content);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Create file
    ipcMain.handle('fs:create-file', async (_, filePath: string, content?: string) => {
        try {
            await fsManager.createFile(filePath, content);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Create directory
    ipcMain.handle('fs:create-directory', async (_, dirPath: string) => {
        try {
            await fsManager.createDirectory(dirPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Delete file or directory
    ipcMain.handle('fs:delete', async (_, itemPath: string) => {
        try {
            await fsManager.delete(itemPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Rename file or directory
    ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
        try {
            await fsManager.rename(oldPath, newPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Check if path exists
    ipcMain.handle('fs:exists', async (_, itemPath: string) => {
        try {
            const exists = await fsManager.exists(itemPath);
            return { success: true, exists };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Get language from file extension
    ipcMain.handle('fs:get-language', async (_, filePath: string) => {
        const language = fsManager.getLanguageFromExtension(filePath);
        return { language };
    });

    // Get Docker image for language
    ipcMain.handle('fs:get-docker-image', async (_, language: string) => {
        const image = fsManager.getDockerImageForLanguage(language);
        return { image };
    });

    console.log('[FileSystem] File system IPC handlers registered');
}
