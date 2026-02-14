import type {
	IStorageService,
	UploadResult
} from '../../src/lib/services/interfaces/IStorageService';

/**
 * Mock implementation of IStorageService for testing
 * Stores files in-memory instead of actual storage
 */
export class MockStorageService implements IStorageService {
	private storage = new Map<string, Buffer>();

	async upload(
		file: Buffer | Uint8Array,
		filename: string,
		contentType: string,
		folder?: string
	): Promise<UploadResult> {
		const key = folder ? `${folder}/${filename}` : filename;
		this.storage.set(key, Buffer.from(file));
		return {
			key,
			url: `mock://${key}`
		};
	}

	async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
		return `mock://${key}?expires=${expiresIn || 3600}`;
	}

	getPublicUrl(key: string): string {
		return `mock://${key}`;
	}

	async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	async exists(key: string): Promise<boolean> {
		return this.storage.has(key);
	}

	// Test helpers
	getStored(key: string): Buffer | undefined {
		return this.storage.get(key);
	}

	clear(): void {
		this.storage.clear();
	}
}
