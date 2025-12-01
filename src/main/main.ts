// src/main/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
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
    // Log about to register handlers
    console.log('[main] About to register Docker IPC handlers');
    // Enregistrer les handlers IPC
    registerDockerHandlers();
    console.log('[main] registerDockerHandlers() returned');
    // Warm-up Docker connection on start for debugging purpose in dev
    if (process.env.NODE_ENV !== 'production') {
        DockerManager.getInstance().checkConnection().then(info => {
            console.log('[main] DockerManager.checkConnection startup ->', info);
        }).catch(err => {
            console.error('[main] DockerManager.checkConnection error ->', err);
        });
    }

    createWindow();
    // Broadcast to renderer that main is ready and handlers are registered
    if (mainWindow && mainWindow.webContents) {
        const sendReady = () => {
            try {
                console.log('[main] Sending main:ready to renderer');
                mainWindow?.webContents.send('main:ready', { handlersRegistered: true });
            } catch (err) {
                console.error('[main] Failed to send main:ready:', err);
            }
        };
        // Send on did-finish-load
        mainWindow.webContents.once('did-finish-load', sendReady);
        // Also send after dom-ready for HMR scenarios
        mainWindow.webContents.once('dom-ready', sendReady);
    }
    // After creating window, log the preload path and whether it exists to help debug preload loading
    const preloadPath = path.join(__dirname, 'preload.js');
    const preloadExists = fs.existsSync(preloadPath);
    console.log('[main] preload path:', preloadPath, 'exists?', preloadExists);

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