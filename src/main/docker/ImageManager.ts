import Docker from 'dockerode';
import { DockerManager } from './DockerManager';

export class ImageManager {
	private docker: Docker;
	private static instance: ImageManager;

	private constructor() {
		this.docker = DockerManager.getInstance().getDockerInstance();
	}

	public static getInstance(): ImageManager {
		if (!ImageManager.instance) {
			ImageManager.instance = new ImageManager();
		}
		return ImageManager.instance;
	}

	public async listImages(): Promise<Docker.ImageInfo[]> {
		return this.docker.listImages();
	}

	public async pullImage(repoTag: string, onProgress?: (event: any) => void): Promise<void> {
		// repoTag: 'node:18-alpine' or 'ubuntu:22.04'
		const stream = await this.docker.pull(repoTag);
		return new Promise((resolve, reject) => {
			this.docker.modem.followProgress(stream, (err: Error | null, res: any) => {
				if (err) return reject(err);
				resolve(res);
			}, (event: any) => {
				if (onProgress) onProgress(event);
			});
		});
	}

	public async removeImage(idOrName: string, options?: { force?: boolean, noprune?: boolean }): Promise<void> {
		const image = this.docker.getImage(idOrName);
		await image.remove(options);
	}

	public async searchDockerHub(term: string): Promise<any[]> {
		// Docker Engine API supports search for images
		return this.docker.searchImages({ term });
	}

	public async getImageDetails(idOrName: string): Promise<Docker.ImageInspectInfo> {
		const image = this.docker.getImage(idOrName);
		return image.inspect();
	}
}
