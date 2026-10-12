import * as fs from 'fs';
import * as path from 'path';

/**
 * Default image of each language. Python and Ruby use the Debian-based "slim" images, like
 * the project templates and the terminal: packages installed in the project folder by one
 * container (compiled extensions are tied to its C library) must work in the others.
 */
export const LANGUAGE_IMAGES: Record<string, string> = {
    python: 'python:3.11-slim',
    javascript: 'node:20-alpine',
    typescript: 'node:20-alpine',
    java: 'eclipse-temurin:17-jdk-alpine',
    go: 'golang:1.22-alpine',
    rust: 'rust:1.75-alpine',
    ruby: 'ruby:3.2-slim',
    php: 'php:8.2-cli-alpine',
    c: 'alpine:3.19',
    cpp: 'alpine:3.19',
};

// Image of a project whose language is unknown
const DEFAULT_IMAGE = 'alpine:latest';

/**
 * The environment a project runs in: its terminal, the runs of files in its language and
 * the installation of its template all use this image.
 */
export interface ProjectEnvironment {
    // Declared in .docker-ide.json, or recognised from the project's files
    language?: string;
    image: string;
    // The project's server (from its template): ports to publish, command that starts it
    ports: number[];
    startCommand?: string;
}

// Files that tell the language of a project without .docker-ide.json
const LANGUAGE_MARKERS: [string, string][] = [
    ['requirements.txt', 'python'],
    ['pyproject.toml', 'python'],
    ['Pipfile', 'python'],
    ['package.json', 'javascript'],
    ['Gemfile', 'ruby'],
    ['go.mod', 'go'],
    ['Cargo.toml', 'rust'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['composer.json', 'php'],
];

const IMAGE_PATTERN = /^[a-z0-9][a-z0-9._/:@-]{0,254}$/i;

const asString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

const asPorts = (value: unknown): number[] =>
    Array.isArray(value)
        ? value.filter((port) => Number.isInteger(port) && port > 0 && port < 65536).slice(0, 10)
        : [];

async function readProjectConfig(projectPath: string): Promise<Record<string, unknown> | null> {
    try {
        const config = JSON.parse(await fs.promises.readFile(path.join(projectPath, '.docker-ide.json'), 'utf-8'));
        return config && typeof config === 'object' ? config : null;
    } catch {
        return null;
    }
}

async function detectLanguage(projectPath: string): Promise<string | undefined> {
    for (const [file, language] of LANGUAGE_MARKERS) {
        if (fs.existsSync(path.join(projectPath, file))) return language;
    }
    return undefined;
}

export async function getProjectEnvironment(projectPath: string): Promise<ProjectEnvironment> {
    const config = await readProjectConfig(projectPath);
    const declaredLanguage = asString(config?.language);
    const language = declaredLanguage ?? await detectLanguage(projectPath);
    const declaredImage = asString(config?.image);

    return {
        language,
        image: declaredImage && IMAGE_PATTERN.test(declaredImage)
            ? declaredImage
            : (language && LANGUAGE_IMAGES[language]) || DEFAULT_IMAGE,
        ports: asPorts(config?.ports),
        startCommand: asString(config?.startCommand),
    };
}

// Where a project keeps the dependencies that would otherwise stay in a container
export const PYTHON_VENV = '/workspace/.venv';
export const RUBY_GEMS = '/workspace/.gems';

// Repository of an image: "python" for python:3.11-slim or docker.io/library/python
function imageRepository(image: string): string {
    const withoutDigest = image.split('@')[0];
    const withoutTag = withoutDigest.replace(/:[^/]*$/, '');
    return withoutTag.split('/').pop() ?? '';
}

/**
 * Shell commands that make a container use the project's dependencies. Setup, terminal and
 * run containers are all disposable: packages installed in one of them were lost (a Flask
 * project failed with "No module named flask"). They now go in the project folder, the one
 * thing those containers share, like node_modules: a virtualenv for Python, a gem directory
 * for Ruby. With `create`, the virtualenv is created when missing (setup and terminal);
 * runs only use it if it exists.
 */
export function dependencyEnvScript(image: string, create = false): string {
    switch (imageRepository(image)) {
        case 'python': {
            // `--copies`: no symlinks, which bind mounts of Windows folders may not support.
            // Activation is guarded: in sh, sourcing a missing file ends the shell.
            const activate = `if [ -f ${PYTHON_VENV}/bin/activate ]; then . ${PYTHON_VENV}/bin/activate; fi; `;
            return create
                ? `[ -x ${PYTHON_VENV}/bin/python ] || python -m venv --copies ${PYTHON_VENV}; ${activate}`
                : activate;
        }
        case 'ruby':
            return `export GEM_HOME=${RUBY_GEMS} PATH="${RUBY_GEMS}/bin:$PATH"; `;
        default:
            return '';
    }
}

/**
 * The command run with the project's dependencies (see dependencyEnvScript). Arguments go
 * through "$@" untouched.
 */
export function withDependencies(image: string, command: string[], create = false): string[] {
    const script = dependencyEnvScript(image, create);
    return script ? ['sh', '-c', `${script}exec "$@"`, 'sh', ...command] : command;
}
