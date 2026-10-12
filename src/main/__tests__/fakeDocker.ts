// Minimal fake Docker Engine API on a unix socket, to test the Docker code without a daemon
// (CI has none). It implements just what the runner, shells and image manager use.
import * as fs from 'fs';
import * as http from 'http';
import type { Socket } from 'net';

// One frame of Docker's multiplexed stream: 8-byte header (stream type, size) + payload
export function frame(type: 1 | 2, payload: string): Buffer {
    const data = Buffer.from(payload);
    const header = Buffer.alloc(8);
    header[0] = type;
    header.writeUInt32BE(data.length, 4);
    return Buffer.concat([header, data]);
}

export interface FakeExec {
    id: string;
    containerId: string;
    cmd: string[];
    exitCode: number | null;
}

export interface FakeContainer {
    id: string;
    name: string;
    image: string;
    running: boolean;
    labels: Record<string, string>;
    config: any;
    waiting: http.ServerResponse[];
}

export interface FakeDockerOptions {
    images?: string[];
    // Error reported in the middle of every pull, like a network drop
    pullError?: string;
    // What an exec writes on its stream, chunk by chunk, and its exit code
    execResult?: (exec: FakeExec) => { chunks: Buffer[]; exitCode: number };
}

export interface FakeDocker {
    containers: FakeContainer[];
    images: Set<string>;
    execs: FakeExec[];
    createCalls: number;
    // Bytes received on shell attach connections (what the shell would read on stdin)
    attachInput: Buffer;
    close(): Promise<void>;
}

export async function startFakeDocker(socketPath: string, options: FakeDockerOptions = {}): Promise<FakeDocker> {
    const sockets = new Set<Socket>();
    let nextId = 0;
    const fake: FakeDocker = {
        containers: [],
        images: new Set(options.images ?? []),
        execs: [],
        createCalls: 0,
        attachInput: Buffer.alloc(0),
        close: () => new Promise<void>((resolve) => {
            sockets.forEach((socket) => socket.destroy());
            server.close(() => resolve());
        }),
    };

    const stopContainer = (container: FakeContainer) => {
        container.running = false;
        container.waiting.splice(0).forEach((res) => res.end(JSON.stringify({ StatusCode: 0 })));
    };

    const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://docker');
        const route = url.pathname.replace(/^\/v[0-9.]+/, '');
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            const json = (status: number, payload?: unknown) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(payload === undefined ? '' : JSON.stringify(payload));
            };
            const findContainer = (idOrName: string) =>
                fake.containers.find((c) => c.id === idOrName || c.name === idOrName);
            let match: RegExpMatchArray | null;

            if ((match = route.match(/^\/images\/(.+)\/json$/))) {
                const name = decodeURIComponent(match[1]);
                return fake.images.has(name) ? json(200, { Id: name }) : json(404, { message: `No such image: ${name}` });
            }
            if (route === '/images/create') {
                const ref = `${url.searchParams.get('fromImage')}:${url.searchParams.get('tag') || 'latest'}`;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.write(JSON.stringify({ status: `Pulling ${ref}` }) + '\r\n');
                if (options.pullError) {
                    res.write(JSON.stringify({ errorDetail: { message: options.pullError }, error: options.pullError }) + '\r\n');
                } else {
                    fake.images.add(ref);
                    res.write(JSON.stringify({ status: `Downloaded newer image for ${ref}` }) + '\r\n');
                }
                return res.end();
            }
            if (route === '/containers/json') {
                let list = fake.containers;
                const filters = url.searchParams.get('filters');
                const names: string[] | undefined = filters ? JSON.parse(filters).name : undefined;
                if (names) {
                    // Like Docker: a regular expression, matched anywhere in "/name"
                    list = list.filter((c) => names.some((pattern) => new RegExp(pattern).test(`/${c.name}`)));
                }
                return json(200, list.map((c) => ({
                    Id: c.id, Names: [`/${c.name}`], Image: c.image, State: c.running ? 'running' : 'exited', Labels: c.labels,
                })));
            }
            if (route === '/containers/create') {
                fake.createCalls++;
                const name = url.searchParams.get('name') ?? `ctr-${nextId}`;
                const config = JSON.parse(body || '{}');
                if (!fake.images.has(config.Image)) return json(404, { message: `No such image: ${config.Image}` });
                if (findContainer(name)) return json(409, { message: `Conflict. The container name "/${name}" is already in use` });
                const container: FakeContainer = {
                    id: `c${++nextId}`, name, image: config.Image, running: false, labels: config.Labels ?? {}, config, waiting: [],
                };
                fake.containers.push(container);
                return json(201, { Id: container.id });
            }
            if ((match = route.match(/^\/containers\/([^/]+)\/(json|start|stop|wait|resize)$/))) {
                const container = findContainer(match[1]);
                if (!container) return json(404, { message: `No such container: ${match[1]}` });
                switch (match[2]) {
                    case 'json':
                        return json(200, {
                            Id: container.id,
                            State: { Running: container.running },
                            Config: { Image: container.image, Labels: container.labels },
                        });
                    case 'start':
                        container.running = true;
                        res.writeHead(204);
                        return res.end();
                    case 'stop':
                        stopContainer(container);
                        res.writeHead(204);
                        return res.end();
                    case 'wait':
                        // Answered when the container stops
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return container.waiting.push(res);
                    default:
                        return json(200, {});
                }
            }
            if ((match = route.match(/^\/containers\/([^/]+)$/)) && req.method === 'DELETE') {
                const container = findContainer(match[1]);
                if (container) {
                    stopContainer(container);
                    fake.containers = fake.containers.filter((c) => c !== container);
                }
                res.writeHead(204);
                return res.end();
            }
            if ((match = route.match(/^\/containers\/([^/]+)\/exec$/))) {
                const exec: FakeExec = { id: `e${++nextId}`, containerId: match[1], cmd: JSON.parse(body || '{}').Cmd, exitCode: null };
                fake.execs.push(exec);
                return json(201, { Id: exec.id });
            }
            if ((match = route.match(/^\/exec\/([^/]+)\/json$/))) {
                const exec = fake.execs.find((e) => e.id === match![1]);
                return json(200, { Running: false, ExitCode: exec ? exec.exitCode : null });
            }
            json(404, { message: `fake docker: unhandled ${req.method} ${route}` });
        });
    });

    // exec start and attach are HTTP upgrades: the socket then carries the raw streams
    server.on('upgrade', (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
        const route = new URL(req.url ?? '/', 'http://docker').pathname.replace(/^\/v[0-9.]+/, '');
        socket.write('HTTP/1.1 101 UPGRADED\r\nContent-Type: application/vnd.docker.raw-stream\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n');

        if (/^\/containers\/[^/]+\/attach$/.test(route)) {
            const record = (data: Buffer) => { fake.attachInput = Buffer.concat([fake.attachInput, data]); };
            record(head);
            socket.on('data', record);
            return;
        }

        const execId = route.match(/^\/exec\/([^/]+)\/start$/)?.[1];
        const exec = fake.execs.find((e) => e.id === execId);
        if (!exec) return socket.end();
        const { chunks, exitCode } = options.execResult?.(exec) ?? { chunks: [frame(1, 'ok\n')], exitCode: 0 };
        // Each chunk is written separately so that frames can be split across reads
        let index = 0;
        const writeNext = () => {
            if (index < chunks.length) {
                socket.write(chunks[index++]);
                setTimeout(writeNext, 5);
            } else {
                exec.exitCode = exitCode;
                socket.end();
            }
        };
        setTimeout(writeNext, 5);
    });

    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    try {
        fs.unlinkSync(socketPath);
    } catch {
        // No leftover socket
    }
    await new Promise<void>((resolve) => server.listen(socketPath, () => resolve()));
    return fake;
}
