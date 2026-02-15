import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinioStorageService } from '../../../src/lib/services/MinioStorageService';

// Mock the minio module
const mockPutObject = vi.fn();
const mockGetObject = vi.fn();
const mockStatObject = vi.fn();
const mockBucketExists = vi.fn();
const mockMakeBucket = vi.fn();
const mockSetBucketPolicy = vi.fn();

vi.mock('minio', () => {
	return {
		Client: vi.fn(function () {
			return {
				putObject: mockPutObject,
				getObject: mockGetObject,
				statObject: mockStatObject,
				bucketExists: mockBucketExists,
				makeBucket: mockMakeBucket,
				setBucketPolicy: mockSetBucketPolicy
			};
		})
	};
});

describe('MinioStorageService', () => {
	let service: MinioStorageService;
	const config = {
		endPoint: 'minio',
		port: 9000,
		useSSL: false,
		accessKey: 'minioadmin',
		secretKey: 'minioadmin',
		bucket: 'receipts'
	};

	beforeEach(() => {
		vi.clearAllMocks();
		service = new MinioStorageService(config);
	});

	it('getPublicUrl returns /api/images/...', () => {
		const key = 'test-image.jpg';
		const result = service.getPublicUrl(key);
		expect(result).toBe(`/api/images/${key}`);
	});

	it('getInternalUrl returns http://minio...', () => {
		const key = 'test-image.jpg';
		const result = service.getInternalUrl(key);
		expect(result).toBe(`http://minio:9000/receipts/${key}`);
	});

	it('upload calls client.putObject and returns public URL', async () => {
		const buffer = Buffer.from('test');
		const filename = 'test.jpg';
		const contentType = 'image/jpeg';

		mockBucketExists.mockResolvedValue(true);

		const result = await service.upload(buffer, filename, contentType);

		expect(mockPutObject).toHaveBeenCalledWith(
			'receipts',
			expect.stringMatching(/.+\.jpg$/),
			buffer,
			buffer.length,
			{ 'Content-Type': contentType }
		);
		expect(result.url).toBe(`/api/images/${result.key}`);
	});

	it('getObject calls client.getObject', async () => {
		const key = 'test-image.jpg';
		await service.getObject(key);
		expect(mockGetObject).toHaveBeenCalledWith('receipts', key);
	});

	it('getObjectStat calls client.statObject', async () => {
		const key = 'test-image.jpg';
		const mockStat = {
			metaData: { 'content-type': 'image/jpeg' },
			size: 1024
		};
		mockStatObject.mockResolvedValue(mockStat);

		const result = await service.getObjectStat(key);

		expect(mockStatObject).toHaveBeenCalledWith('receipts', key);
		expect(result).toEqual({
			contentType: 'image/jpeg',
			size: 1024
		});
	});
});
