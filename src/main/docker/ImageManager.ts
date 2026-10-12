import Docker from 'dockerode';
import { DockerManager } from './DockerManager';

export class ImageManager {
	private static instance: ImageManager;

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	private constructor() {}

	// Looked up on each call: DockerManager.checkConnection() may switch to another client
	private get docker(): Docker {
		return DockerManager.getInstance().getDockerInstance();
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

	/**
	 * True if the exact image (name and tag) is present locally
	 */
	public async hasImage(repoTag: string): Promise<boolean> {
		try {
			await this.docker.getImage(repoTag).inspect();
			return true;
		} catch (error: any) {
			if (error?.statusCode === 404) return false;
			throw error;
		}
	}

	public async pullImage(repoTag: string, onProgress?: (event: any) => void): Promise<void> {
		// repoTag: 'node:18-alpine' or 'ubuntu:22.04'
		const docker = this.docker;
		const stream = await docker.pull(repoTag);
		return new Promise((resolve, reject) => {
			// Failures during the pull (network drop, disk full...) arrive as progress events
			// with an `error` field, and followProgress still finishes without an error
			let pullError: string | undefined;
			docker.modem.followProgress(stream, (err: Error | null) => {
				if (err) return reject(err);
				if (pullError) return reject(new Error(pullError));
				resolve();
			}, (event: any) => {
				if (event?.error) {
					pullError = event.errorDetail?.message || event.error;
				}
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
