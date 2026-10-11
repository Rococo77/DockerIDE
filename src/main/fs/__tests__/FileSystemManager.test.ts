import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemManager, isPathInside } from '../FileSystemManager';

// electron-log not available in test env — stub it
vi.mock('../../logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Creating symlinks on Windows needs extra privileges
const itWithSymlinks = it.skipIf(process.platform === 'win32');

function freshManager(): FileSystemManager {
    // Reset the singleton so each test starts with no allowed folder
    (FileSystemManager as unknown as { instance?: FileSystemManager }).instance = undefined;
    return FileSystemManager.getInstance();
}

describe('isPathInside', () => {
    it('accepts the root itself and anything below it', () => {
        expect(isPathInside('/ws', '/ws', path.posix)).toBe(true);
        expect(isPathInside('/ws', '/ws/src/main.py', path.posix)).toBe(true);
        // A name starting with '..' is not the parent directory
        expect(isPathInside('/ws', '/ws/..hidden', path.posix)).toBe(true);
    });

    it('rejects parents and siblings sharing a prefix', () => {
        expect(isPathInside('/ws', '/', path.posix)).toBe(false);
        expect(isPathInside('/ws', '/ws-other/file', path.posix)).toBe(false);
        expect(isPathInside('/ws', '/etc/passwd', path.posix)).toBe(false);
    });

    it('handles a filesystem root as the workspace', () => {
        expect(isPathInside('/', '/home/user/file.py', path.posix)).toBe(true);
        expect(isPathInside('D:\\', 'D:\\proj\\main.py', path.win32)).toBe(true);
    });

    it('compares Windows paths case-insensitively and rejects other drives', () => {
        expect(isPathInside('C:\\Users\\Me\\Proj', 'c:\\users\\me\\proj\\main.py', path.win32)).toBe(true);
        expect(isPathInside('C:\\Users\\Me\\Proj', 'D:\\Users\\Me\\Proj\\main.py', path.win32)).toBe(false);
    });
});

describe('FileSystemManager', () => {
    let manager: FileSystemManager;
    let tmpDir: string;
    let workspace: string; // the folder the user opened
    let outside: string;   // a folder the renderer must not reach

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dockeride-test-'));
        workspace = path.join(tmpDir, 'workspace');
        outside = path.join(tmpDir, 'outside');
        fs.mkdirSync(workspace);
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');

        manager = freshManager();
        manager.setWorkspace(workspace);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('path guard', () => {
        it('allows files inside the workspace, including ones not created yet', async () => {
            const filePath = path.join(workspace, 'src', 'main.py');
            await manager.writeFile(filePath, 'print(1)');

            const result = await manager.readFile(filePath);
            expect(result.content).toBe('print(1)');
            expect(result.path).toBe(filePath);
        });

        it('blocks .. traversal and absolute paths outside the workspace', async () => {
            const secret = path.join(outside, 'secret.txt');

            await expect(manager.readFile(path.join(workspace, '..', 'outside', 'secret.txt'))).rejects.toThrow('Access denied');
            await expect(manager.readFile(secret)).rejects.toThrow('Access denied');
            await expect(manager.writeFile(path.join(workspace, '..', 'evil.txt'), 'x')).rejects.toThrow('Access denied');
            await expect(manager.createDirectory(path.join(workspace, '..', 'evil'))).rejects.toThrow('Access denied');
            await expect(manager.delete(outside)).rejects.toThrow('Access denied');
            await expect(manager.rename(secret, path.join(workspace, 'stolen.txt'))).rejects.toThrow('Access denied');
            await expect(manager.readDirectory(tmpDir)).rejects.toThrow('Access denied');

            expect(fs.existsSync(path.join(tmpDir, 'evil.txt'))).toBe(false);
            expect(fs.existsSync(secret)).toBe(true);
        });

        it('also guards exists() and getStats()', async () => {
            const secret = path.join(outside, 'secret.txt');

            await expect(manager.exists(secret)).rejects.toThrow('Access denied');
            await expect(manager.getStats(secret)).rejects.toThrow('Access denied');
            await expect(manager.exists(path.join(workspace, 'missing.txt'))).resolves.toBe(false);
        });

        itWithSymlinks('blocks symlinks pointing outside the workspace', async () => {
            fs.symlinkSync(outside, path.join(workspace, 'link'));

            await expect(manager.readFile(path.join(workspace, 'link', 'secret.txt'))).rejects.toThrow('Access denied');
            await expect(manager.writeFile(path.join(workspace, 'link', 'new.txt'), 'x')).rejects.toThrow('Access denied');
            expect(fs.existsSync(path.join(outside, 'new.txt'))).toBe(false);
        });

        itWithSymlinks('blocks writing through a broken symlink', async () => {
            const target = path.join(outside, 'created-through-link.txt');
            fs.symlinkSync(target, path.join(workspace, 'dangling'));

            await expect(manager.writeFile(path.join(workspace, 'dangling'), 'x')).rejects.toThrow('broken symbolic link');
            expect(fs.existsSync(target)).toBe(false);
        });

        itWithSymlinks('allows symlinks that stay inside the workspace', async () => {
            fs.mkdirSync(path.join(workspace, 'real'));
            fs.writeFileSync(path.join(workspace, 'real', 'a.txt'), 'a');
            fs.symlinkSync(path.join(workspace, 'real'), path.join(workspace, 'alias'));

            const result = await manager.readFile(path.join(workspace, 'alias', 'a.txt'));
            expect(result.content).toBe('a');
        });

        it('refuses everything until a folder has been opened', async () => {
            await expect(freshManager().readFile(path.join(workspace, 'a.txt'))).rejects.toThrow('No workspace set');
        });
    });

    describe('readDirectory', () => {
        it('lists visible entries, directories first', async () => {
            fs.writeFileSync(path.join(workspace, 'b.txt'), '');
            fs.mkdirSync(path.join(workspace, 'src'));
            fs.writeFileSync(path.join(workspace, '.env'), '');

            const nodes = await manager.readDirectory(workspace);
            expect(nodes.map(n => n.name)).toEqual(['src', 'b.txt']);
        });
    });

    describe('createProject', () => {
        let parent: string;

        beforeEach(() => {
            parent = path.join(tmpDir, 'projects');
            fs.mkdirSync(parent);
            manager.setProjectParentDirectory(parent);
        });

        it('creates the folder and grants access to it, keeping the open workspace', async () => {
            const projectPath = await manager.createProject(parent, 'mon-projet');

            expect(projectPath).toBe(path.join(parent, 'mon-projet'));
            await manager.writeFile(path.join(projectPath, 'main.py'), 'print(1)');
            await manager.writeFile(path.join(workspace, 'still-ok.txt'), 'ok');
            // Picking a location doesn't open the whole parent folder to the renderer
            await expect(manager.writeFile(path.join(parent, 'other.txt'), 'x')).rejects.toThrow('Access denied');
        });

        it('only creates projects in the folder picked in the dialog', async () => {
            await expect(manager.createProject(outside, 'mon-projet')).rejects.toThrow('folder dialog');
            await expect(freshManager().createProject(parent, 'mon-projet')).rejects.toThrow('folder dialog');
            expect(fs.existsSync(path.join(outside, 'mon-projet'))).toBe(false);
        });

        it.each(['', '.', '..', '../evil', 'a/b', 'a\\b', 'mon projet'])('rejects project name %j', async (name) => {
            await expect(manager.createProject(parent, name)).rejects.toThrow('Invalid project name');
        });

        it('accepts an existing empty folder but never a non-empty one', async () => {
            fs.mkdirSync(path.join(parent, 'empty'));
            fs.mkdirSync(path.join(parent, 'used'));
            fs.writeFileSync(path.join(parent, 'used', 'keep.txt'), 'keep');

            await expect(manager.createProject(parent, 'empty')).resolves.toBe(path.join(parent, 'empty'));
            await expect(manager.createProject(parent, 'used')).rejects.toThrow('not empty');
            expect(fs.readFileSync(path.join(parent, 'used', 'keep.txt'), 'utf-8')).toBe('keep');
        });
    });
});
