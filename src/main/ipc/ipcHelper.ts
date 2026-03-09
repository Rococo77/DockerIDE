import { ipcMain } from 'electron';

/**
 * Register an IPC handler with standard try-catch error wrapping.
 * Reduces boilerplate across all handler files.
 */
export function handleIpc<T = any>(
    channel: string,
    handler: (...args: any[]) => Promise<T> | T,
): void {
    ipcMain.handle(channel, async (_event, ...args) => {
        try {
            return await handler(...args);
        } catch (error: any) {
            return { success: false, error: error?.message ?? String(error) };
        }
    });
}
