import { BrowserWindow } from 'electron';
import { CodeRunner } from '../runner/CodeRunner';
import { ShellManager } from '../runner/InteractiveShell';
import { ComposeManager } from '../docker/ComposeManager';
import { handleIpc } from './ipcHelper';

function getMainWindow(): BrowserWindow | undefined {
    return BrowserWindow.getAllWindows()[0];
}

export function registerRunnerHandlers(): void {
    const runner = CodeRunner.getInstance();
    const shellManager = ShellManager.getInstance();

    console.log('[Runner] Registering code runner IPC handlers...');

    // Run code
    handleIpc('runner:run', async (config: {
        filePath: string;
        workspacePath: string;
        language: string;
    }) => {
        const mainWindow = getMainWindow();
        const onProgress = (status: string) => {
            mainWindow?.webContents.send('runner:progress', { status });
        };
        const result = await runner.runCode(config, onProgress);
        return { success: true, ...result };
    });

    handleIpc('runner:get-languages', () => runner.getSupportedLanguages());

    handleIpc('runner:get-language-config', (language: string) => {
        const config = runner.getLanguageConfig(language);
        if (config) {
            return { success: true, image: config.image, extensions: config.fileExtensions };
        }
        return { success: false };
    });

    handleIpc('runner:check-image', async (imageName: string) => {
        const available = await runner.isImageAvailable(imageName);
        return { success: true, available };
    });

    handleIpc('runner:ensure-image', async (imageName: string) => {
        const mainWindow = getMainWindow();
        const onProgress = (status: string) => {
            mainWindow?.webContents.send('runner:progress', { status });
        };
        const ready = await runner.ensureImage(imageName, onProgress);
        return { success: ready };
    });

    // Interactive Shell Handlers
    handleIpc('shell:start', async (config: {
        shellId: string;
        image?: string;
        language?: string;
        workspacePath?: string;
    }) => {
        const mainWindow = getMainWindow();

        let shell = shellManager.getShell(config.shellId);
        if (shell && shell.isActive()) {
            return { success: true, message: 'Shell already running' };
        }

        shell = shellManager.createShell(config.shellId);

        shell.on('message', (msg: { type: string; data: string }) => {
            mainWindow?.webContents.send('shell:message', { shellId: config.shellId, ...msg });
        });
        shell.on('close', () => {
            mainWindow?.webContents.send('shell:closed', { shellId: config.shellId });
        });

        const started = await shell.start({
            image: config.image,
            language: config.language,
            workspacePath: config.workspacePath,
        });
        return { success: started };
    });

    handleIpc('shell:write', (config: { shellId: string; data: string }) => {
        const shell = shellManager.getShell(config.shellId);
        if (!shell || !shell.isActive()) {
            return { success: false, error: 'Shell not running' };
        }
        shell.writeLine(config.data);
        return { success: true };
    });

    handleIpc('shell:stop', async (shellId: string) => {
        await shellManager.stopShell(shellId);
        return { success: true };
    });

    handleIpc('shell:list', () => {
        const shells = shellManager.getActiveShells();
        return { success: true, shells };
    });

    handleIpc('shell:resize', async (config: { shellId: string; cols: number; rows: number }) => {
        const shell = shellManager.getShell(config.shellId);
        if (shell && shell.isActive()) {
            await shell.resize(config.cols, config.rows);
            return { success: true };
        }
        return { success: false, error: 'Shell not running' };
    });

    // Framework Setup
    handleIpc('runner:setup-framework', async (config: {
        projectPath: string;
        image: string;
        installCommand: string;
    }) => {
        const mainWindow = getMainWindow();
        const onProgress = (status: string) => {
            mainWindow?.webContents.send('runner:setup-progress', { status, type: 'progress' });
        };
        const onOutput = (data: string) => {
            mainWindow?.webContents.send('runner:setup-output', { data, type: 'output' });
        };

        return await runner.runFrameworkSetup({
            projectPath: config.projectPath,
            image: config.image,
            installCommand: config.installCommand,
            onOutput,
            onProgress,
        });
    });

    // Project Container Management
    handleIpc('runner:get-project-container', (projectPath: string) => {
        const info = runner.getProjectContainerInfo(projectPath);
        return { success: true, container: info || null };
    });

    handleIpc('runner:stop-project-container', async (projectPath: string) => {
        await runner.stopProjectContainer(projectPath);
        return { success: true };
    });

    handleIpc('runner:remove-project-container', async (projectPath: string) => {
        await runner.removeProjectContainer(projectPath);
        return { success: true };
    });

    handleIpc('runner:is-container-running', (projectPath: string) => {
        const running = runner.isProjectContainerRunning(projectPath);
        return { success: true, running };
    });

    handleIpc('runner:list-project-containers', () => {
        const containers = runner.listProjectContainers();
        return { success: true, containers };
    });

    handleIpc('runner:stop-all-containers', async () => {
        await runner.stopAllProjectContainers();
        return { success: true };
    });

    // Docker Compose handlers
    const compose = ComposeManager.getInstance();

    handleIpc('compose:has-file', (projectPath: string) => {
        return { success: true, hasCompose: compose.hasComposeFile(projectPath) };
    });

    handleIpc('compose:up', async (projectPath: string, options?: { build?: boolean }) => {
        const result = await compose.up(projectPath, { detach: true, build: options?.build });
        return { success: result.success, output: result.output, error: result.error };
    });

    handleIpc('compose:down', async (projectPath: string, options?: { removeVolumes?: boolean }) => {
        const result = await compose.down(projectPath, options);
        return { success: result.success, output: result.output, error: result.error };
    });

    handleIpc('compose:ps', async (projectPath: string) => {
        const services = await compose.ps(projectPath);
        return { success: true, services };
    });

    handleIpc('compose:logs', async (projectPath: string, options?: { service?: string; tail?: number }) => {
        const result = await compose.logs(projectPath, options);
        return { success: result.success, output: result.output, error: result.error };
    });

    handleIpc('compose:restart', async (projectPath: string, service?: string) => {
        const result = await compose.restart(projectPath, service);
        return { success: result.success, output: result.output, error: result.error };
    });

    handleIpc('runner:generate-dockerfile', (language: string, entryFile: string) => {
        const dockerfile = runner.generateDockerfile(language, entryFile);
        return { success: !!dockerfile, dockerfile };
    });

    console.log('[Runner] Code runner IPC handlers registered');
}
