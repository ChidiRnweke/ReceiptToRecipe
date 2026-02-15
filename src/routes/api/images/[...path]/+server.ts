import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AppFactory } from '$lib/factories';
import { MinioStorageService } from '$lib/services/MinioStorageService';

/**
 * Proxy route for serving images stored in MinIO.
 * Avoids exposing internal MinIO hostnames to browsers.
 *
 * URL format: /api/images/{key} where key is e.g. "receipts/abc-123.jpg"
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const key = params.path;

	if (!key) {
		throw error(400, 'Missing image path');
	}

	// Basic path traversal protection
	if (key.includes('..') || key.startsWith('/')) {
		throw error(400, 'Invalid image path');
	}

	const storageService = AppFactory.getStorageService();

	if (!(storageService instanceof MinioStorageService)) {
		// Fallback: if using FileSystemStorageService, the image should be
		// served directly by SvelteKit static file serving at /uploads/...
		throw error(404, 'Image proxy only available with MinIO storage');
	}

	try {
		// Get metadata first for content-type
		const stat = await storageService.getObjectStat(key);
		const stream = await storageService.getObject(key);

		// Collect stream into buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of stream) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		// Set aggressive caching - receipt images are immutable (UUID filenames)
		setHeaders({
			'Content-Type': stat.contentType || 'image/jpeg',
			'Content-Length': buffer.length.toString(),
			'Cache-Control': 'public, max-age=31536000, immutable'
		});

		return new Response(buffer);
	} catch (err) {
		console.error(`Failed to proxy image ${key}:`, err);
		throw error(404, 'Image not found');
	}
};
