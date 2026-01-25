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
	private publicBaseUrl: string;

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
		this.publicBaseUrl = `${protocol}://${config.endPoint}:${config.port}/${config.bucket}`;
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

	getPublicUrl(key: string): string {
		return `${this.publicBaseUrl}/${key}`;
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
