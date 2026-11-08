import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GET } from '../../../../src/routes/api/images/[...path]/+server';
import { AppFactory } from '../../../../src/lib/factories';
import { MinioStorageService } from '../../../../src/lib/services/MinioStorageService';
import { MockStorageService } from '../../../mocks/MockStorageService';
import { Readable } from 'stream';

// Mock SvelteKit error
vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		return Object.assign(new Error(message), { status });
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
vi.mock('../../../../src/lib/factories', () => ({
	AppFactory: {
		getStorageService: vi.fn()
	}
}));

type ImageRequestEvent = Parameters<typeof GET>[0];

describe('GET /api/images/[...path]', () => {
	let mockSetHeaders: Mock<ImageRequestEvent['setHeaders']>;
	let mockService: MinioStorageService;
	let mockClient: ReturnType<typeof getMockClient>;

	// The route reads only params and setHeaders, so a partial event is enough
	function makeEvent(path: string): ImageRequestEvent {
		return { params: { path }, setHeaders: mockSetHeaders } as unknown as ImageRequestEvent;
	}

	// The minio Client is mocked above, so its methods are vi.fn() instances
	function getMockClient(service: MinioStorageService) {
		return vi.mocked(service['client']);
	}

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
		mockClient = getMockClient(mockService);

		// Default AppFactory to return our mock service
		vi.mocked(AppFactory.getStorageService).mockReturnValue(mockService);
	});

	it('should throw 400 if path is missing', async () => {
		const requestEvent = makeEvent('');

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400, message: 'Missing image path' });
		}
	});

	it('should throw 400 for path traversal', async () => {
		const requestEvent = makeEvent('../secret.txt');

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 400, message: 'Invalid image path' });
		}
	});

	it('should throw 404 if storage service is not MinioStorageService', async () => {
		// Mock AppFactory to return something else
		const otherService = new MockStorageService();
		vi.mocked(AppFactory.getStorageService).mockReturnValue(otherService);

		const requestEvent = makeEvent('valid.jpg');

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({
				status: 404,
				message: 'Image proxy only available with MinIO storage'
			});
		}
	});

	it('should return 200 with image content and headers', async () => {
		const key = 'test.jpg';
		const content = Buffer.from('fake-image-content');

		// Mock metadata
		mockClient.statObject.mockResolvedValue({
			metaData: { 'content-type': 'image/jpeg' },
			size: content.length,
			etag: 'test-etag',
			lastModified: new Date()
		});

		// Mock stream
		const stream = Readable.from(content);
		mockClient.getObject.mockResolvedValue(stream);

		const requestEvent = makeEvent(key);

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

		const requestEvent = makeEvent(key);

		try {
			await GET(requestEvent);
			expect.fail('Should have thrown');
		} catch (e: unknown) {
			expect(e).toMatchObject({ status: 404, message: 'Image not found' });
		}
	});
});
