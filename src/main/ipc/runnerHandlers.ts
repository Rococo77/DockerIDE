import { ipcMain, BrowserWindow } from 'electron';
import { CodeRunner } from '../runner/CodeRunner';

export function registerRunnerHandlers(): void {
    const runner = CodeRunner.getInstance();

    console.log('[Runner] Registering code runner IPC handlers...');

    // Run code
    ipcMain.handle('runner:run', async (event, config: {
        filePath: string;
        workspacePath: string;
        language: string;
    }) => {
        try {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            
            // Progress callback to send updates to renderer
            const onProgress = (status: string) => {
                mainWindow?.webContents.send('runner:progress', { status });
            };

            const result = await runner.runCode(config, onProgress);
            return { success: true, ...result };
        } catch (error: any) {
            return {
                success: false,
                output: '',
                error: error.message,
            };
        }
    });

    // Get supported languages
    ipcMain.handle('runner:get-languages', async () => {
        return runner.getSupportedLanguages();
    });

    // Get language config
    ipcMain.handle('runner:get-language-config', async (_, language: string) => {
        const config = runner.getLanguageConfig(language);
        if (config) {
            return {
                success: true,
                image: config.image,
                extensions: config.fileExtensions,
            };
        }
        return { success: false };
    });

    // Check if image is available
    ipcMain.handle('runner:check-image', async (_, imageName: string) => {
        try {
            const available = await runner.isImageAvailable(imageName);
            return { success: true, available };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Ensure image is pulled
    ipcMain.handle('runner:ensure-image', async (event, imageName: string) => {
        try {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            const onProgress = (status: string) => {
                mainWindow?.webContents.send('runner:progress', { status });
            };

            const ready = await runner.ensureImage(imageName, onProgress);
            return { success: ready };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    console.log('[Runner] Code runner IPC handlers registered');
}
