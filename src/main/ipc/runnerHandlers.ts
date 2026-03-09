import { ipcMain, BrowserWindow } from 'electron';
import { CodeRunner } from '../runner/CodeRunner';
import { ShellManager, InteractiveShell } from '../runner/InteractiveShell';
import { ComposeManager } from '../docker/ComposeManager';

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

    // ===================================
    // Project Container Management Handlers
    // ===================================

    // Get container info for a project
    ipcMain.handle('runner:get-project-container', async (_, projectPath: string) => {
        try {
            const info = runner.getProjectContainerInfo(projectPath);
            return { success: true, container: info || null };
        } catch (error: any) {
            return { success: false, error: error.message, container: null };
        }
    });

    // Stop project container
    ipcMain.handle('runner:stop-project-container', async (_, projectPath: string) => {
        try {
            await runner.stopProjectContainer(projectPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Remove project container
    ipcMain.handle('runner:remove-project-container', async (_, projectPath: string) => {
        try {
            await runner.removeProjectContainer(projectPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Check if project container is running
    ipcMain.handle('runner:is-container-running', async (_, projectPath: string) => {
        try {
            const running = runner.isProjectContainerRunning(projectPath);
            return { success: true, running };
        } catch (error: any) {
            return { success: false, error: error.message, running: false };
        }
    });

    // List all project containers
    ipcMain.handle('runner:list-project-containers', async () => {
        try {
            const containers = runner.listProjectContainers();
            return { success: true, containers };
        } catch (error: any) {
            return { success: false, error: error.message, containers: [] };
        }
    });

    // Stop all project containers
    ipcMain.handle('runner:stop-all-containers', async () => {
        try {
            await runner.stopAllProjectContainers();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // === Docker Compose handlers ===
    const compose = ComposeManager.getInstance();

    ipcMain.handle('compose:has-file', async (_event, projectPath: string) => {
        return { success: true, hasCompose: compose.hasComposeFile(projectPath) };
    });

    ipcMain.handle('compose:up', async (_event, projectPath: string, options?: { build?: boolean }) => {
        try {
            const result = await compose.up(projectPath, { detach: true, build: options?.build });
            return { success: result.success, output: result.output, error: result.error };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('compose:down', async (_event, projectPath: string, options?: { removeVolumes?: boolean }) => {
        try {
            const result = await compose.down(projectPath, options);
            return { success: result.success, output: result.output, error: result.error };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('compose:ps', async (_event, projectPath: string) => {
        try {
            const services = await compose.ps(projectPath);
            return { success: true, services };
        } catch (error: any) {
            return { success: false, error: error.message, services: [] };
        }
    });

    ipcMain.handle('compose:logs', async (_event, projectPath: string, options?: { service?: string; tail?: number }) => {
        try {
            const result = await compose.logs(projectPath, options);
            return { success: result.success, output: result.output, error: result.error };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('compose:restart', async (_event, projectPath: string, service?: string) => {
        try {
            const result = await compose.restart(projectPath, service);
            return { success: result.success, output: result.output, error: result.error };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Dockerfile generation
    ipcMain.handle('runner:generate-dockerfile', async (_event, language: string, entryFile: string) => {
        try {
            const dockerfile = runner.generateDockerfile(language, entryFile);
            return { success: !!dockerfile, dockerfile };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    console.log('[Runner] Code runner IPC handlers registered');
}
