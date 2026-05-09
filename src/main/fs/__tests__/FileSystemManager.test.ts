import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemManager } from '../FileSystemManager';

// electron-log not available in test env — stub it
vi.mock('../../logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('FileSystemManager', () => {
    let manager: FileSystemManager;
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dockeride-test-'));
        // Access the singleton and reset it for each test
        manager = (FileSystemManager as any).instance = undefined as any;
        manager = FileSystemManager.getInstance();
        manager.setWorkspace(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('assertInWorkspace (path traversal prevention)', () => {
        it('allows a file inside workspace', async () => {
            const filePath = path.join(tmpDir, 'file.txt');
            fs.writeFileSync(filePath, 'hello');
            const result = await manager.readFile(filePath);
            expect(result.content).toBe('hello');
        });

        it('allows a nested file inside workspace', async () => {
            const subDir = path.join(tmpDir, 'sub');
            fs.mkdirSync(subDir);
            const filePath = path.join(subDir, 'nested.txt');
            fs.writeFileSync(filePath, 'nested');
            const result = await manager.readFile(filePath);
            expect(result.content).toBe('nested');
        });

        it('blocks path traversal with ..', async () => {
            const traversalPath = path.join(tmpDir, '..', 'etc', 'passwd');
            await expect(manager.readFile(traversalPath)).rejects.toThrow('Access denied');
        });

        it('blocks absolute path outside workspace', async () => {
            await expect(manager.readFile('/etc/passwd')).rejects.toThrow('Access denied');
        });

        it('blocks path traversal in writeFile', async () => {
            const traversalPath = path.join(tmpDir, '..', 'evil.txt');
            await expect(manager.writeFile(traversalPath, 'evil')).rejects.toThrow('Access denied');
        });

        it('blocks path traversal in delete', async () => {
            const traversalPath = path.join(tmpDir, '..', 'something');
            await expect(manager.delete(traversalPath)).rejects.toThrow('Access denied');
        });

        it('throws when no workspace is set', () => {
            const fresh = new (FileSystemManager as any)();
            expect(() => (fresh as any).assertInWorkspace('/tmp/foo')).toThrow('No workspace set');
        });
    });

    describe('readFile / writeFile', () => {
        it('writes and reads a file', async () => {
            const filePath = path.join(tmpDir, 'test.txt');
            await manager.writeFile(filePath, 'content');
            const result = await manager.readFile(filePath);
            expect(result.content).toBe('content');
            expect(result.path).toBe(filePath);
        });
    });

    describe('createDirectory', () => {
        it('creates a directory inside workspace', async () => {
            const dirPath = path.join(tmpDir, 'newdir');
            await manager.createDirectory(dirPath);
            expect(fs.existsSync(dirPath)).toBe(true);
        });

        it('blocks creating directory outside workspace', async () => {
            const dirPath = path.join(tmpDir, '..', 'baddir');
            await expect(manager.createDirectory(dirPath)).rejects.toThrow('Access denied');
        });
    });

    describe('readDirectory', () => {
        it('lists files in workspace', async () => {
            fs.writeFileSync(path.join(tmpDir, 'a.txt'), '');
            fs.writeFileSync(path.join(tmpDir, 'b.txt'), '');
            const nodes = await manager.readDirectory(tmpDir);
            expect(nodes.map(n => n.name)).toContain('a.txt');
            expect(nodes.map(n => n.name)).toContain('b.txt');
        });

        it('blocks listing outside workspace', async () => {
            await expect(manager.readDirectory(path.join(tmpDir, '..'))).rejects.toThrow('Access denied');
        });
    });
});
