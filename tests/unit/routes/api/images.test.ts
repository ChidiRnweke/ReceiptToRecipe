import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../../../../src/routes/api/images/[...path]/+server';
import { AppFactory } from '../../../../src/lib/factories';
import { MinioStorageService } from '../../../../src/lib/services/MinioStorageService';
import { error } from '@sveltejs/kit';
import { Readable } from 'stream';

// Mock SvelteKit error
vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		const err = new Error(message);
		(err as any).status = status;
		return err;
	}
}));

// Mock minio module so MinioStorageService uses a mock client
vi.mock('minio', () => {
	const Client = vi.fn();
	Client.prototype.bucketExists = vi.fn();
	Client.prototype.makeBucket = vi.fn();
	Client.prototype.putObject = vi.fn();
	Client.prototype.getObject = vi.fn();
	Client.prototype.statObject = vi.fn();
	return { Client };
});

// Mock AppFactory
vi.mock('../../../../../src/lib/factories', () => ({
	AppFactory: {
		getStorageService: vi.fn()
	}
}));

describe('GET /api/images/[...path]', () => {
	let mockSetHeaders: any;
	let mockService: MinioStorageService;
	let mockClient: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockSetHeaders = vi.fn();

		// Create a real MinioStorageService, which will use the mocked minio Client
		mockService = new MinioStorageService({
			endPoint: 'localhost',
			port: 9000,
			useSSL: false,
			accessKey: 'user',
			secretKey: 'pass',
			bucket: 'test-bucket'
		});

		// Get the mocked client instance
		// @ts-ignore
		mockClient = (mockService as any).client;

		// Default AppFactory to return our mock service
		(AppFactory.getStorageService as any).mockReturnValue(mockService);
	});

	it('should throw 400 if path is missing', async () => {
		const requestEvent: any = {
			params: { path: '' },
			setHeaders: mockSetHeaders
		};

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: any) {
			expect(e.status).toBe(400);
			expect(e.message).toBe('Missing image path');
		}
	});

	it('should throw 400 for path traversal', async () => {
		const requestEvent: any = {
			params: { path: '../secret.txt' },
			setHeaders: mockSetHeaders
		};

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: any) {
			expect(e.status).toBe(400);
			expect(e.message).toBe('Invalid image path');
		}
	});

	it('should throw 404 if storage service is not MinioStorageService', async () => {
		// Mock AppFactory to return something else
		const otherService = {};
		(AppFactory.getStorageService as any).mockReturnValue(otherService);

		const requestEvent: any = {
			params: { path: 'valid.jpg' },
			setHeaders: mockSetHeaders
		};

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: any) {
			expect(e.status).toBe(404);
			expect(e.message).toBe('Image proxy only available with MinIO storage');
		}
	});

	it('should return 200 with image content and headers', async () => {
		const key = 'test.jpg';
		const content = Buffer.from('fake-image-content');

		// Mock metadata
		mockClient.statObject.mockResolvedValue({
			metaData: { 'content-type': 'image/jpeg' },
			size: content.length
		});

		// Mock stream
		const stream = Readable.from(content);
		mockClient.getObject.mockResolvedValue(stream);

		const requestEvent: any = {
			params: { path: key },
			setHeaders: mockSetHeaders
		};

		const response = await GET(requestEvent);
		const responseBuffer = Buffer.from(await response.arrayBuffer());

		expect(mockClient.statObject).toHaveBeenCalledWith('test-bucket', key);
		expect(mockClient.getObject).toHaveBeenCalledWith('test-bucket', key);

		expect(responseBuffer.toString()).toBe('fake-image-content');

		expect(mockSetHeaders).toHaveBeenCalledWith({
			'Content-Type': 'image/jpeg',
			'Content-Length': content.length.toString(),
			'Cache-Control': 'public, max-age=31536000, immutable'
		});
	});

	it('should throw 404 if storage throws error (e.g. object not found)', async () => {
		const key = 'not-found.jpg';

		mockClient.statObject.mockRejectedValue(new Error('Not found'));

		const requestEvent: any = {
			params: { path: key },
			setHeaders: mockSetHeaders
		};

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: any) {
			expect(e.status).toBe(404);
			expect(e.message).toBe('Image not found');
		}
	});
});
