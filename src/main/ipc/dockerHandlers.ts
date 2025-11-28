import { ipcMain } from 'electron';
import {DockerManager} from '../docker/DockerManager';

export function registerDockerHandlers() {
    const dockerManager = DockerManager.getInstance();

    /**
     * Vérifier la connexion Docker
     */
    ipcMain.handle('docker:check-connection', async () => {
        try {
            const info = await dockerManager.checkConnection();
            return { success: true, data: info };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    /**
     * Ping Docker (vérification rapide)
     */
    ipcMain.handle('docker:ping', async () => {
        try {
            const isConnected = await dockerManager.ping();
            return { success: true, data: isConnected };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
}