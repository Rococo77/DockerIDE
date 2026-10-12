// src/global.ts (a .ts file on purpose: skipLibCheck skips errors in .d.ts files)
// './preload/index', not './preload': that would resolve to src/preload.ts, which exports
// nothing, and skipLibCheck would hide the error, leaving window.electronAPI typed as any.
import type { ElectronAPI } from './preload/index';

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export {};
