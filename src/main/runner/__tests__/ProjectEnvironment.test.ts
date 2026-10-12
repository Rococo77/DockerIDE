import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LANGUAGE_IMAGES, getProjectEnvironment, withDependencies } from '../ProjectEnvironment';

describe('getProjectEnvironment', () => {
    let project: string;

    beforeEach(() => {
        project = fs.mkdtempSync(path.join(os.tmpdir(), 'dockeride-env-'));
    });

    afterEach(() => {
        fs.rmSync(project, { recursive: true, force: true });
    });

    const writeConfig = (config: unknown) =>
        fs.writeFileSync(path.join(project, '.docker-ide.json'), JSON.stringify(config));

    it('uses the image, server command and ports declared by the project', async () => {
        writeConfig({ language: 'php', image: 'php:8.2-cli', startCommand: 'php artisan serve', ports: [8000] });

        expect(await getProjectEnvironment(project)).toEqual({
            language: 'php', image: 'php:8.2-cli', ports: [8000], startCommand: 'php artisan serve',
        });
    });

    it('ignores invalid values', async () => {
        writeConfig({ language: 'python', image: 'not an image!', ports: [0, 5000, 'x', 70000, 1.5] });

        expect(await getProjectEnvironment(project)).toEqual({
            language: 'python', image: LANGUAGE_IMAGES.python, ports: [5000], startCommand: undefined,
        });
    });

    it('recognises the language of a project without .docker-ide.json', async () => {
        fs.writeFileSync(path.join(project, 'requirements.txt'), 'flask\n');

        expect(await getProjectEnvironment(project)).toMatchObject({ language: 'python', image: LANGUAGE_IMAGES.python });
    });

    it('falls back to a plain shell image', async () => {
        expect(await getProjectEnvironment(project)).toEqual({
            language: undefined, image: 'alpine:latest', ports: [], startCommand: undefined,
        });
    });
});

// The scripts use /workspace (where containers mount the project): run them in a real shell
// against a temporary folder instead
describe.skipIf(process.platform === 'win32')('dependencies kept in the project folder', () => {
    let workspace: string;
    let bin: string;

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dockeride-deps-'));
        bin = path.join(workspace, 'bin');
        fs.mkdirSync(bin);
    });

    afterEach(() => {
        fs.rmSync(workspace, { recursive: true, force: true });
    });

    const run = (command: string[]) => {
        const local = command.map((arg) => arg.split('/workspace').join(workspace));
        return spawnSync(local[0], local.slice(1), {
            encoding: 'utf8',
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        });
    };

    const fakeVenv = () => {
        fs.mkdirSync(path.join(workspace, '.venv', 'bin'), { recursive: true });
        fs.writeFileSync(path.join(workspace, '.venv', 'bin', 'activate'),
            `VIRTUAL_ENV="${workspace}/.venv"; export VIRTUAL_ENV; PATH="${workspace}/.venv/bin:$PATH"; export PATH\n`);
        fs.writeFileSync(path.join(workspace, '.venv', 'bin', 'python'),
            '#!/bin/sh\nprintf \'venv python|%s|\\n\' "$@"\n', { mode: 0o755 });
    };

    it('runs Python with the project virtualenv, keeping arguments intact', () => {
        fakeVenv();

        const result = run(withDependencies(LANGUAGE_IMAGES.python, ['python', '/workspace/mon fichier.py']));

        expect(result.stdout).toBe(`venv python|${workspace}/mon fichier.py|\n`);
    });

    it('runs Python normally when the project has no virtualenv', () => {
        const result = run(withDependencies(LANGUAGE_IMAGES.python, ['echo', 'ok']));

        expect(result.stdout).toBe('ok\n');
    });

    it('still opens the terminal if the virtualenv cannot be created', () => {
        fs.writeFileSync(path.join(bin, 'python'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

        const result = run(withDependencies(LANGUAGE_IMAGES.python, ['echo', 'shell'], true));

        expect(result.stdout).toBe('shell\n');
    });

    it('installs Ruby gems in the project', () => {
        const result = run(withDependencies(LANGUAGE_IMAGES.ruby, ['sh', '-c', 'echo "$GEM_HOME"']));

        expect(result.stdout).toBe(`${workspace}/.gems\n`);
    });

    it('leaves other languages unchanged', () => {
        expect(withDependencies(LANGUAGE_IMAGES.javascript, ['node', 'index.js'])).toEqual(['node', 'index.js']);
    });
});
