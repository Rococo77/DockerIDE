import * as fs from 'fs';
import * as path from 'path';
import { app, ipcMain, dialog, BrowserWindow, OpenDialogOptions } from 'electron';
import { FileSystemManager } from '../fs/FileSystemManager';
import log from '../logger';

export function registerFileSystemHandlers(): void {
    const fsManager = FileSystemManager.getInstance();

    log.info('[FileSystem] Registering file system IPC handlers...');

    // Since Electron 43 a dialog without defaultPath opens in Downloads and the OS no longer
    // reopens the last folder used, so remember it ourselves (home folder at first).
    let lastDialogFolder: string | null = null;

    const pickFolder = async (options: OpenDialogOptions): Promise<string | null> => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        const defaultPath = lastDialogFolder && fs.existsSync(lastDialogFolder)
            ? lastDialogFolder
            : app.getPath('home');
        const result = await dialog.showOpenDialog(mainWindow, { defaultPath, ...options });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        const folderPath = result.filePaths[0];
        lastDialogFolder = path.dirname(folderPath);
        return folderPath;
    };

    // Open folder dialog
    ipcMain.handle('fs:open-folder', async () => {
        const folderPath = await pickFolder({
            properties: ['openDirectory'],
            title: 'Ouvrir un dossier de projet'
        });

        if (folderPath) {
            fsManager.setWorkspace(folderPath);
            return { success: true, path: folderPath };
        }
        return { success: false, path: null };
    });

    // Get current workspace
    ipcMain.handle('fs:get-workspace', async () => {
        return fsManager.getWorkspace();
    });

    // There is deliberately no fs:set-workspace: the renderer only gets access to folders
    // the user picks in a native dialog (fs:open-folder) or creates with fs:create-project.

    // Pick the location of a new project, without changing the open workspace
    ipcMain.handle('fs:select-directory', async () => {
        const folderPath = await pickFolder({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Choisir l\'emplacement du projet'
        });

        if (folderPath) {
            fsManager.setProjectParentDirectory(folderPath);
            return { success: true, path: folderPath };
        }
        return { success: false, path: null };
    });

    // Create a new project folder inside the location picked with fs:select-directory
    ipcMain.handle('fs:create-project', async (_, parentDir: string, name: string) => {
        try {
            const projectPath = await fsManager.createProject(parentDir, name);
            return { success: true, path: projectPath };
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

    log.info('[FileSystem] File system IPC handlers registered');
}
