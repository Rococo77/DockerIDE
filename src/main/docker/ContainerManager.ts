import Docker, { Container, ContainerCreateOptions } from 'dockerode';
import { DockerManager } from './DockerManager';

export class ContainerManager {
	private docker: Docker;
	private static instance: ContainerManager;

	private constructor() {
		this.docker = DockerManager.getInstance().getDockerInstance();
	}

	public static getInstance(): ContainerManager {
		if (!ContainerManager.instance) {
			ContainerManager.instance = new ContainerManager();
		}
		return ContainerManager.instance;
	}

	public async listContainers(all = true): Promise<Docker.ContainerInfo[]> {
		return this.docker.listContainers({ all });
	}

	public async createContainer(options: ContainerCreateOptions): Promise<Container> {
		return this.docker.createContainer(options);
	}

	public async startContainer(id: string): Promise<void> {
		const container = this.docker.getContainer(id);
		await container.start();
	}

	public async stopContainer(id: string, t?: number): Promise<void> {
		const container = this.docker.getContainer(id);
		await container.stop({ t });
	}

	public async removeContainer(id: string, options?: { force?: boolean; v?: boolean }): Promise<void> {
		const container = this.docker.getContainer(id);
		await container.remove(options);
	}

	public async getContainerLogs(id: string, opts: any = { stdout: true, stderr: true, timestamps: false, tail: 100 }): Promise<string> {
		const container = this.docker.getContainer(id);
		// container.logs can return a Buffer or a stream
		const result: any = await container.logs(opts as any);
		if (Buffer.isBuffer(result)) {
			return result.toString();
		}
		const stream: NodeJS.ReadableStream = result as NodeJS.ReadableStream;
		return new Promise((resolve, reject) => {
			let data = '';
			stream.on('data', (chunk: Buffer | string) => {
				data += chunk.toString();
			});
			stream.on('end', () => resolve(data));
			stream.on('error', reject);
		});
	}

	public async execInContainer(id: string, cmd: string[] | string, opts: any = {}): Promise<string> {
		const container = this.docker.getContainer(id);
		const command = Array.isArray(cmd) ? cmd : [cmd as string];
		const exec = await container.exec({ Cmd: command, AttachStdout: true, AttachStderr: true, ...opts });
		const result: any = await exec.start({ hijack: true, stdin: false });
		const stream: NodeJS.ReadableStream = result as NodeJS.ReadableStream;
		return new Promise((resolve, reject) => {
			let output = '';
			stream.on('data', (chunk: Buffer | string) => {
				output += chunk.toString();
			});
			stream.on('end', () => resolve(output));
			stream.on('error', reject);
		});
	}

	public async getContainerStats(id: string, stream = false): Promise<any> {
		const container = this.docker.getContainer(id);
		if (stream === true) {
			const statsStream = await container.stats({ stream: true as true });
			return statsStream;
		}
		// stream=false -> returns a ContainerStats object directly
		const stats = await container.stats({ stream: false as false });
		return stats;
	}
}
