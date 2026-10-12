import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('child_process', () => ({
    spawn: spawnMock,
    execSync: vi.fn(() => 'Docker Compose version v2.29.0'),
}));

import { ComposeManager } from '../ComposeManager';

function fakeProcess(exitCode = 0) {
    const proc = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
    });
    setImmediate(() => proc.emit('close', exitCode));
    return proc;
}

describe('ComposeManager', () => {
    const compose = ComposeManager.getInstance();

    beforeEach(() => {
        spawnMock.mockReset();
        spawnMock.mockImplementation(() => fakeProcess());
    });

    it('runs docker compose without a shell and with the inherited environment', async () => {
        const result = await compose.up('/projects/demo', { build: true });

        expect(result.success).toBe(true);
        // No `shell` and no `env` option: the CLI gets the user's environment as-is
        expect(spawnMock).toHaveBeenCalledWith('docker', ['compose', 'up', '-d', '--build'], { cwd: '/projects/demo' });
    });

    it('passes a valid service name and tail to logs', async () => {
        await compose.logs('/projects/demo', { service: 'db', tail: 50 });

        expect(spawnMock).toHaveBeenCalledWith(
            'docker',
            ['compose', 'logs', '--no-color', '--tail', '50', 'db'],
            { cwd: '/projects/demo' },
        );
    });

    it.each(['--help', '-f', 'web; rm -rf /', 'a b', '../db'])('rejects service name %j', async (service) => {
        await expect(compose.logs('/projects/demo', { service })).rejects.toThrow('Invalid service name');
        await expect(compose.restart('/projects/demo', service)).rejects.toThrow('Invalid service name');
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it('adds the Docker CLI locations to PATH on macOS (apps started from the Finder lack them)', async () => {
        const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        try {
            await compose.ps('/projects/demo');
        } finally {
            Object.defineProperty(process, 'platform', platform);
        }

        const env = spawnMock.mock.calls[0][2].env;
        expect(env.PATH.split(':')).toEqual(expect.arrayContaining(['/usr/local/bin', '/opt/homebrew/bin']));
    });

    it.each([0, -1, 1.5, '--follow'])('rejects tail value %j', async (tail) => {
        await expect(compose.logs('/projects/demo', { tail: tail as number })).rejects.toThrow('Invalid tail value');
        expect(spawnMock).not.toHaveBeenCalled();
    });
});
