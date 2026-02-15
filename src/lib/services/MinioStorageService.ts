import { Client } from 'minio';
import { v4 as uuidv4 } from 'uuid';
import type { IStorageService, UploadResult } from './interfaces';

export interface MinioConfig {
	endPoint: string;
	port: number;
	useSSL: boolean;
	accessKey: string;
	secretKey: string;
	bucket: string;
}

export class MinioStorageService implements IStorageService {
	private client: Client;
	private bucket: string;
	/** Internal URL for server-to-MinIO communication */
	private internalBaseUrl: string;

	constructor(config: MinioConfig) {
		this.client = new Client({
			endPoint: config.endPoint,
			port: config.port,
			useSSL: config.useSSL,
			accessKey: config.accessKey,
			secretKey: config.secretKey
		});
		this.bucket = config.bucket;
		const protocol = config.useSSL ? 'https' : 'http';
		this.internalBaseUrl = `${protocol}://${config.endPoint}:${config.port}/${config.bucket}`;
	}

	async upload(
		file: Buffer | Uint8Array,
		filename: string,
		contentType: string,
		folder?: string
	): Promise<UploadResult> {
		// Ensure bucket exists before upload (lazy check)
		try {
			const exists = await this.client.bucketExists(this.bucket);
			if (!exists) {
				await this.client.makeBucket(this.bucket);
				// Set policy to public if needed, or assume private
				// For this app, we might need public read access for images
				const policy = {
					Version: '2012-10-17',
					Statement: [
						{
							Effect: 'Allow',
							Principal: { AWS: ['*'] },
							Action: ['s3:GetObject'],
							Resource: [`arn:aws:s3:::${this.bucket}/*`]
						}
					]
				};
				await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
			}
		} catch (err) {
			console.warn('Failed to ensure bucket exists:', err);
			// Fall through and try uploading anyway, maybe it exists but we lack permissions to check
		}

		const extension = filename.split('.').pop() || '';
		const uniqueFilename = `${uuidv4()}.${extension}`;
		const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

		const buffer = file instanceof Uint8Array ? Buffer.from(file) : file;

		await this.client.putObject(this.bucket, key, buffer, buffer.length, {
			'Content-Type': contentType
		});

		return {
			key,
			url: this.getPublicUrl(key)
		};
	}

	async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
		return await this.client.presignedGetObject(this.bucket, key, expiresIn);
	}

	/**
	 * Returns a proxy URL that goes through the SvelteKit server.
	 * This avoids exposing the internal MinIO hostname to browsers.
	 */
	getPublicUrl(key: string): string {
		return `/api/images/${key}`;
	}

	/**
	 * Returns the internal MinIO URL for server-to-server communication
	 * (e.g. passing to external APIs like Mistral OCR).
	 */
	getInternalUrl(key: string): string {
		return `${this.internalBaseUrl}/${key}`;
	}

	/**
	 * Get the raw object as a readable stream (used by the image proxy route).
	 */
	async getObject(key: string): Promise<import('stream').Readable> {
		return await this.client.getObject(this.bucket, key);
	}

	/**
	 * Get object metadata (content-type, size, etc.).
	 */
	async getObjectStat(key: string): Promise<{ contentType?: string; size: number }> {
		const stat = await this.client.statObject(this.bucket, key);
		return {
			contentType: stat.metaData['content-type'],
			size: stat.size
		};
	}

	async delete(key: string): Promise<void> {
		await this.client.removeObject(this.bucket, key);
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.client.statObject(this.bucket, key);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Ensure the bucket exists, create if not
	 */
	async ensureBucket(): Promise<void> {
		const exists = await this.client.bucketExists(this.bucket);
		if (!exists) {
			await this.client.makeBucket(this.bucket);
		}
	}
}
