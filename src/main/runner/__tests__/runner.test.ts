import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// electron-log not available in test env — stub it
vi.mock('../../logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { startFakeDocker, frame, FakeDocker, FakeDockerOptions } from '../../__tests__/fakeDocker';
import { DockerManager } from '../../docker/DockerManager';
import { ImageManager } from '../../docker/ImageManager';
import { CodeRunner } from '../CodeRunner';
import { ProjectContainerManager } from '../ProjectContainer';
import { InteractiveShell } from '../InteractiveShell';

// The fake Docker daemon listens on a unix socket
describe.skipIf(process.platform === 'win32')('code runner and shells (fake Docker daemon)', () => {
    let tmpDir: string;
    let docker: FakeDocker | undefined;

    async function useFakeDocker(options: FakeDockerOptions = {}): Promise<FakeDocker> {
        const socketPath = path.join(tmpDir, 'docker.sock');
        docker = await startFakeDocker(socketPath, options);
        process.env.DOCKER_HOST = `unix://${socketPath}`;
        // Fresh singletons talking to this daemon
        (DockerManager.getInstance() as any).docker = null;
        (ProjectContainerManager as any).instance = undefined;
        (CodeRunner as any).instance = undefined;
        return docker;
    }

    const run = (workspacePath: string, file: string, language: string) =>
        CodeRunner.getInstance().runCode({ workspacePath, filePath: path.join(workspacePath, file), language });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dockeride-runner-'));
    });

    afterEach(async () => {
        await docker?.close();
        docker = undefined;
        delete process.env.DOCKER_HOST;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('commands', () => {
        it('runs Java with the file as an argument, not inside a second sh -c', async () => {
            const fake = await useFakeDocker({ images: ['eclipse-temurin:17-jdk-alpine'] });

            const result = await run('/projects/demo', 'Main.java', 'java');

            expect(result.success).toBe(true);
            expect(fake.execs.map((e) => e.cmd)).toEqual([
                ['sh', '-c', 'javac "$1" && java -cp "$(dirname "$1")" "$2"', 'sh', '/workspace/Main.java', 'Main'],
            ]);
        });

        it('passes a file name with spaces as a single argument', async () => {
            const fake = await useFakeDocker({ images: ['python:3.11-alpine'] });

            await run('/projects/demo', 'mon fichier.py', 'python');

            expect(fake.execs[0].cmd).toEqual(['python', '/workspace/mon fichier.py']);
        });

        it('keeps spaces and quotes in file names when the commands run in a real shell', () => {
            // Stub compilers that print the arguments they get; the C one also "builds" a program
            const bin = path.join(tmpDir, 'bin');
            fs.mkdirSync(bin);
            const printArgs = '#!/bin/sh\nprintf \'%s|\' "$(basename "$0")" "$@"; echo\n';
            for (const tool of ['javac', 'java']) {
                fs.writeFileSync(path.join(bin, tool), printArgs, { mode: 0o755 });
            }
            fs.writeFileSync(path.join(bin, 'gcc'), `${printArgs}
for a in "$@"; do [ "$prev" = "-o" ] && out="$a"; prev="$a"; done
printf '#!/bin/sh\\necho ran\\n' > "$out" && chmod +x "$out"
`, { mode: 0o755 });
            const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
            const runner = CodeRunner.getInstance();
            const execute = (cmd: string[]) => spawnSync(cmd[0], cmd.slice(1), { env, encoding: 'utf8' });

            const java = execute(runner.getLanguageConfig('java')!.command("/workspace/mon dossier/l'exo.java"));
            expect(java.stdout).toBe("javac|/workspace/mon dossier/l'exo.java|\njava|-cp|/workspace/mon dossier|l'exo|\n");

            const program = `mon prog l'exo ${process.pid}`;
            try {
                const c = execute(runner.getLanguageConfig('c')!.command(`/workspace/${program}.c`));
                expect(c.stdout).toBe(`gcc|/workspace/${program}.c|-o|/tmp/${program}|-static|\nran\n`);
            } finally {
                fs.rmSync(`/tmp/${program}`, { force: true });
            }
        });
    });

    describe('project containers', () => {
        it('installs the C compiler on the first run without hanging', async () => {
            const fake = await useFakeDocker({ images: ['alpine:3.19'] });

            const result = await run('/projects/demo', 'main.c', 'c');

            expect(result.success).toBe(true);
            expect(fake.execs.map((e) => e.cmd[2])).toEqual([
                'apk add --no-cache gcc g++ musl-dev make',
                'gcc "$1" -o "/tmp/$2" -static && "/tmp/$2"',
            ]);
        });

        it('reports a failed compiler install and removes the container', async () => {
            const fake = await useFakeDocker({
                images: ['alpine:3.19'],
                execResult: (exec) => exec.cmd[2]?.startsWith('apk add')
                    ? { chunks: [frame(2, 'ERROR: unable to fetch\n')], exitCode: 1 }
                    : { chunks: [], exitCode: 0 },
            });

            const result = await run('/projects/demo', 'main.c', 'c');

            expect(result.success).toBe(false);
            expect(result.error).toContain('compilateur');
            expect(fake.containers).toHaveLength(0);
        });

        it('reassembles output frames split across chunks', async () => {
            const output = Buffer.concat([frame(1, 'hello '), frame(2, 'oops\n'), frame(1, 'wörld\n')]);
            // Cut inside a header, inside a payload and inside a multi-byte character
            const cuts = [3, 11, 20, output.indexOf(Buffer.from('ö')) + 1, output.length];
            const chunks = cuts.map((end, i) => output.subarray(i === 0 ? 0 : cuts[i - 1], end));
            await useFakeDocker({ images: ['python:3.11-alpine'], execResult: () => ({ chunks, exitCode: 0 }) });

            const result = await run('/projects/demo', 'main.py', 'python');

            expect(result.output).toBe('hello wörld\n');
            expect(result.error).toBe('oops\n');
        });

        it('gives projects with the same folder name their own container', async () => {
            const fake = await useFakeDocker({ images: ['python:3.11-alpine'] });

            await run('/home/me/cours/tp1', 'main.py', 'python');
            await run('/home/me/perso/tp1', 'main.py', 'python');

            expect(fake.containers.map((c) => c.config.HostConfig.Binds)).toEqual([
                ['/home/me/cours/tp1:/workspace'],
                ['/home/me/perso/tp1:/workspace'],
            ]);
            expect(new Set(fake.containers.map((c) => c.name)).size).toBe(2);
        });

        it('does not reuse a container whose name only starts with the project one', async () => {
            const fake = await useFakeDocker({ images: ['python:3.11-alpine'] });
            const name = (ProjectContainerManager.getInstance() as any).getContainerName('/projects/tp1');
            fake.containers.push({
                id: 'other', name: `${name}0`, image: 'python:3.11-alpine', running: true,
                labels: {}, config: { HostConfig: { Binds: ['/projects/tp10:/workspace'] } }, waiting: [],
            });

            await run('/projects/tp1', 'main.py', 'python');

            expect(fake.createCalls).toBe(1);
            expect(fake.execs[0].containerId).not.toBe('other');
        });

        it('creates a single container when two runs start together', async () => {
            const fake = await useFakeDocker({ images: ['python:3.11-alpine'] });

            const results = await Promise.all([
                run('/projects/demo', 'a.py', 'python'),
                run('/projects/demo', 'b.py', 'python'),
            ]);

            expect(results.map((r) => r.success)).toEqual([true, true]);
            expect(fake.createCalls).toBe(1);
        });

        it('stops a program that never ends (e.g. an endless loop)', async () => {
            const fake = await useFakeDocker({
                images: ['python:3.11-alpine'],
                execResult: (exec) => exec.cmd.includes('/workspace/loop.py')
                    ? { chunks: [frame(1, 'still running\n')], exitCode: 0, hang: true }
                    : { chunks: [frame(1, 'ok\n')], exitCode: 0 },
            });
            const runner = CodeRunner.getInstance();

            const running = run('/projects/demo', 'loop.py', 'python');
            await vi.waitFor(() => expect(fake.execs).toHaveLength(1));
            expect(await runner.stopRun('/projects/demo')).toBe(true);
            const result = await running;

            expect(result).toMatchObject({ success: false, output: 'still running\n', exitCode: 137 });
            expect(result.error).toContain('Exécution arrêtée');
            // Nothing left to stop, and the next run isn't reported as stopped
            expect(await runner.stopRun('/projects/demo')).toBe(false);
            expect(await run('/projects/demo', 'main.py', 'python')).toMatchObject({ success: true, output: 'ok\n' });
        });

        it('keeps at most about 1 MB of output per run', async () => {
            const line = `${'x'.repeat(99)}\n`;
            const chunks = Array.from({ length: 12 }, () => frame(1, line.repeat(1000)));
            await useFakeDocker({ images: ['python:3.11-alpine'], execResult: () => ({ chunks, exitCode: 0 }) });

            const result = await run('/projects/demo', 'spam.py', 'python');

            expect(result.output.length).toBeLessThan(1_000_100);
            expect(result.output).toMatch(/sortie tronquée/);
        });

        it('reflects containers stopped or removed outside the IDE', async () => {
            const fake = await useFakeDocker({ images: ['python:3.11-alpine'] });
            const runner = CodeRunner.getInstance();
            await run('/projects/demo', 'main.py', 'python');
            expect((await runner.getProjectContainerInfo('/projects/demo'))?.status).toBe('running');

            fake.containers[0].running = false;
            expect((await runner.getProjectContainerInfo('/projects/demo'))?.status).toBe('stopped');

            fake.containers.length = 0;
            expect(await runner.getProjectContainerInfo('/projects/demo')).toBeUndefined();
        });
    });

    describe('images', () => {
        it('checks the exact image tag', async () => {
            await useFakeDocker({ images: ['python:3.11-alpine'] });
            const runner = CodeRunner.getInstance();

            expect(await runner.isImageAvailable('python:3.11-alpine')).toBe(true);
            expect(await runner.isImageAvailable('python:3.11-slim')).toBe(false);
        });

        it('reports a pull that fails midway', async () => {
            await useFakeDocker({ pullError: 'no space left on device' });

            await expect(ImageManager.getInstance().pullImage('python:3.11-alpine')).rejects.toThrow('no space left on device');
            const result = await run('/projects/demo', 'main.py', 'python');
            expect(result.success).toBe(false);
            expect(result.error).toContain('python:3.11-alpine');
        });
    });

    describe('interactive shells', () => {
        it('sends only what the user types to the shell, and closes its stdin on detach', async () => {
            const fake = await useFakeDocker({ images: ['alpine:latest'] });
            const shell = new InteractiveShell();

            expect(await shell.start({ image: 'alpine:latest', workspacePath: '/projects/demo' })).toBe(true);
            shell.writeLine('ls');

            await vi.waitFor(() => expect(fake.attachInput.toString()).toBe('ls\n'));
            expect(fake.containers[0].config.StdinOnce).toBe(true);
            await shell.stop();
        });

        it('reports a closed shell once', async () => {
            await useFakeDocker({ images: ['alpine:latest'] });
            const shell = new InteractiveShell();
            const closed = vi.fn();
            shell.on('close', closed);

            await shell.start({ image: 'alpine:latest' });
            // stop() ends the stream and removes the container: three ways to notice the end
            await shell.stop();

            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(closed).toHaveBeenCalledTimes(1);
        });
    });
});
