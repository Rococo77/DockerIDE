// src/main/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerDockerHandlers } from './ipc/dockerHandlers';
import { DockerManager } from './docker/DockerManager';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            // Vite builds preload to `preload.js` in the build folder
            // preload.js is generated in the same build directory as main.js
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // En développement
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // En production
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Enregistrer les handlers IPC
    registerDockerHandlers();
    // Warm-up Docker connection on start for debugging purpose in dev
    if (process.env.NODE_ENV !== 'production') {
        DockerManager.getInstance().checkConnection().then(info => {
            console.log('[main] DockerManager.checkConnection startup ->', info);
        }).catch(err => {
            console.error('[main] DockerManager.checkConnection error ->', err);
        });
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});