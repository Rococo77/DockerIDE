import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import log from '../logger';

/**
 * Window controls for the custom title bar: the window is frameless, so it has no
 * native minimize / maximize / close buttons.
 */
export function registerWindowHandlers(): void {
    // Act on the window that sent the request
    const senderWindow = (event: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender);

    ipcMain.handle('window:minimize', (event) => {
        senderWindow(event)?.minimize();
    });

    ipcMain.handle('window:toggle-maximize', (event) => {
        const win = senderWindow(event);
        if (!win) return;
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });

    ipcMain.handle('window:close', (event) => {
        senderWindow(event)?.close();
    });

    // File > Quit: quits on every platform, unlike closing the window on macOS
    ipcMain.handle('app:quit', () => {
        app.quit();
    });

    log.info('[Window] Window control IPC handlers registered');
}
