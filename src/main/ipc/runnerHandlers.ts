import { ipcMain, BrowserWindow } from 'electron';
import { CodeRunner } from '../runner/CodeRunner';
import { ShellManager, InteractiveShell } from '../runner/InteractiveShell';

export function registerRunnerHandlers(): void {
    const runner = CodeRunner.getInstance();
    const shellManager = ShellManager.getInstance();

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

    // ===================================
    // Interactive Shell Handlers
    // ===================================

    // Start an interactive shell
    ipcMain.handle('shell:start', async (event, config: {
        shellId: string;
        image?: string;
        language?: string;
        workspacePath?: string;
    }) => {
        try {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            
            // Check if shell already exists
            let shell = shellManager.getShell(config.shellId);
            if (shell && shell.isActive()) {
                return { success: true, message: 'Shell already running' };
            }

            // Create new shell
            shell = shellManager.createShell(config.shellId);

            // Forward messages to renderer
            shell.on('message', (msg: { type: string; data: string }) => {
                mainWindow?.webContents.send('shell:message', {
                    shellId: config.shellId,
                    ...msg,
                });
            });

            shell.on('close', () => {
                mainWindow?.webContents.send('shell:closed', {
                    shellId: config.shellId,
                });
            });

            // Start the shell
            const started = await shell.start({
                image: config.image,
                language: config.language,
                workspacePath: config.workspacePath,
            });

            return { success: started };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Send input to shell
    ipcMain.handle('shell:write', async (_, config: {
        shellId: string;
        data: string;
    }) => {
        try {
            const shell = shellManager.getShell(config.shellId);
            if (!shell || !shell.isActive()) {
                return { success: false, error: 'Shell not running' };
            }

            shell.writeLine(config.data);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Stop a shell
    ipcMain.handle('shell:stop', async (_, shellId: string) => {
        try {
            await shellManager.stopShell(shellId);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Get active shells
    ipcMain.handle('shell:list', async () => {
        try {
            const shells = shellManager.getActiveShells();
            return { success: true, shells };
        } catch (error: any) {
            return { success: false, error: error.message, shells: [] };
        }
    });

    // Resize shell terminal
    ipcMain.handle('shell:resize', async (_, config: {
        shellId: string;
        cols: number;
        rows: number;
    }) => {
        try {
            const shell = shellManager.getShell(config.shellId);
            if (shell && shell.isActive()) {
                await shell.resize(config.cols, config.rows);
                return { success: true };
            }
            return { success: false, error: 'Shell not running' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // ===================================
    // Framework Setup Handler
    // ===================================

    // Run framework installation
    ipcMain.handle('runner:setup-framework', async (event, config: {
        projectPath: string;
        image: string;
        installCommand: string;
    }) => {
        try {
            const mainWindow = BrowserWindow.getAllWindows()[0];

            // Progress callback
            const onProgress = (status: string) => {
                mainWindow?.webContents.send('runner:setup-progress', { 
                    status,
                    type: 'progress'
                });
            };

            // Output callback - send real-time output
            const onOutput = (data: string) => {
                mainWindow?.webContents.send('runner:setup-output', { 
                    data,
                    type: 'output'
                });
            };

            const result = await runner.runFrameworkSetup({
                projectPath: config.projectPath,
                image: config.image,
                installCommand: config.installCommand,
                onOutput,
                onProgress,
            });

            return result;
        } catch (error: any) {
            return {
                success: false,
                output: '',
                error: error.message,
            };
        }
    });

    console.log('[Runner] Code runner IPC handlers registered');
}
