import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$db/client';
import { GlobalSearchService } from '$lib/services/GlobalSearchService';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const query = url.searchParams.get('q')?.trim() ?? '';
	const limitParam = Number(url.searchParams.get('limit') ?? '5');
	const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 10)) : 5;

	if (query.length < 2) {
		return json({
			query,
			results: {
				recipes: [],
				cupboard: [],
				receipts: []
			},
			total: 0,
			usedTrigram: false
		});
	}

	const searchService = new GlobalSearchService(getDb());

	try {
		const results = await searchService.search(locals.user.id, query, limit);
		return json(results);
	} catch {
		return json(
			{
				query,
				results: {
					recipes: [],
					cupboard: [],
					receipts: []
				},
				total: 0,
				usedTrigram: false,
				error: 'Search failed'
			},
			{ status: 500 }
		);
	}
};
