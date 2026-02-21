import type { Database } from '$db/client';
import { sql } from 'drizzle-orm';

export type GlobalSearchGroup = 'recipes' | 'cupboard' | 'receipts';

export interface GlobalSearchItem {
	id: string;
	title: string;
	subtitle: string;
	href: string;
	score: number;
}

export interface GlobalSearchResults {
	recipes: GlobalSearchItem[];
	cupboard: GlobalSearchItem[];
	receipts: GlobalSearchItem[];
}

export interface GlobalSearchResponse {
	query: string;
	results: GlobalSearchResults;
	total: number;
	usedTrigram: boolean;
}

export class GlobalSearchService {
	private trigramEnabled: boolean | null = null;

	constructor(private db: Database) {}

	async search(userId: string, query: string, limitPerGroup = 5): Promise<GlobalSearchResponse> {
		const normalizedQuery = query.trim();
		if (normalizedQuery.length === 0) {
			return {
				query: '',
				results: { recipes: [], cupboard: [], receipts: [] },
				total: 0,
				usedTrigram: false
			};
		}

		const likeValue = `%${normalizedQuery}%`;
		const useTrigram = await this.isTrigramEnabled();

		const [recipes, cupboard, receipts] = await Promise.all([
			this.searchRecipes(userId, normalizedQuery, likeValue, limitPerGroup, useTrigram),
			this.searchCupboard(userId, normalizedQuery, likeValue, limitPerGroup, useTrigram),
			this.searchReceipts(userId, normalizedQuery, likeValue, limitPerGroup, useTrigram)
		]);

		const total = recipes.length + cupboard.length + receipts.length;

		return {
			query: normalizedQuery,
			results: { recipes, cupboard, receipts },
			total,
			usedTrigram: useTrigram
		};
	}

	private async isTrigramEnabled(): Promise<boolean> {
		if (this.trigramEnabled !== null) return this.trigramEnabled;

		const result = await this.db.execute<{ enabled: boolean }>(
			sql`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS enabled`
		);

		this.trigramEnabled = Boolean(result.rows[0]?.enabled);
		return this.trigramEnabled;
	}

	private async searchRecipes(
		userId: string,
		query: string,
		likeValue: string,
		limit: number,
		useTrigram: boolean
	): Promise<GlobalSearchItem[]> {
		const scoreExpr = useTrigram
			? sql`
				(
					COALESCE(ts_rank(
						to_tsvector('english', COALESCE(r.title, '') || ' ' || COALESCE(r.description, '') || ' ' || COALESCE(r.instructions, '')),
						websearch_to_tsquery('english', ${query})
					), 0)
					+ COALESCE(similarity(COALESCE(r.title, ''), ${query}), 0) * 0.75
					+ COALESCE(similarity(COALESCE(r.cuisine_type, ''), ${query}), 0) * 0.35
				)
			`
			: sql`
				COALESCE(ts_rank(
					to_tsvector('english', COALESCE(r.title, '') || ' ' || COALESCE(r.description, '') || ' ' || COALESCE(r.instructions, '')),
					websearch_to_tsquery('english', ${query})
				), 0)
			`;

		const rows = await this.db.execute<{
			id: string;
			title: string;
			cuisine_type: string | null;
			score: number;
		}>(sql`
			SELECT
				r.id,
				r.title,
				r.cuisine_type,
				${scoreExpr} AS score
			FROM recipes r
			WHERE r.user_id = ${userId}
				AND (
					to_tsvector('english', COALESCE(r.title, '') || ' ' || COALESCE(r.description, '') || ' ' || COALESCE(r.instructions, '')) @@ websearch_to_tsquery('english', ${query})
					OR COALESCE(r.title, '') ILIKE ${likeValue}
					OR COALESCE(r.description, '') ILIKE ${likeValue}
					OR COALESCE(r.cuisine_type, '') ILIKE ${likeValue}
				)
			ORDER BY score DESC, r.created_at DESC
			LIMIT ${limit}
		`);

		return rows.rows.map((row) => ({
			id: row.id,
			title: row.title,
			subtitle: row.cuisine_type ? `Cuisine: ${row.cuisine_type}` : 'Recipe',
			href: `/recipes/${row.id}`,
			score: Number(row.score ?? 0)
		}));
	}

	private async searchCupboard(
		userId: string,
		query: string,
		likeValue: string,
		limit: number,
		useTrigram: boolean
	): Promise<GlobalSearchItem[]> {
		const scoreExpr = useTrigram
			? sql`
				(
					COALESCE(ts_rank(
						to_tsvector('english', COALESCE(c.item_name, '') || ' ' || COALESCE(c.category, '') || ' ' || COALESCE(c.notes, '')),
						websearch_to_tsquery('english', ${query})
					), 0)
					+ COALESCE(similarity(COALESCE(c.item_name, ''), ${query}), 0) * 0.8
					+ COALESCE(similarity(COALESCE(c.category, ''), ${query}), 0) * 0.2
				)
			`
			: sql`
				COALESCE(ts_rank(
					to_tsvector('english', COALESCE(c.item_name, '') || ' ' || COALESCE(c.category, '') || ' ' || COALESCE(c.notes, '')),
					websearch_to_tsquery('english', ${query})
				), 0)
			`;

		const rows = await this.db.execute<{
			id: string;
			item_name: string;
			category: string | null;
			quantity: string | null;
			unit: string | null;
			score: number;
		}>(sql`
			SELECT
				c.id,
				c.item_name,
				c.category,
				c.quantity::text AS quantity,
				c.unit,
				${scoreExpr} AS score
			FROM cupboard_items c
			WHERE c.user_id = ${userId}
				AND c.is_depleted = false
				AND (
					to_tsvector('english', COALESCE(c.item_name, '') || ' ' || COALESCE(c.category, '') || ' ' || COALESCE(c.notes, '')) @@ websearch_to_tsquery('english', ${query})
					OR COALESCE(c.item_name, '') ILIKE ${likeValue}
					OR COALESCE(c.category, '') ILIKE ${likeValue}
				)
			ORDER BY score DESC, c.updated_at DESC
			LIMIT ${limit}
		`);

		return rows.rows.map((row) => ({
			id: row.id,
			title: row.item_name,
			subtitle: row.quantity
				? `${row.quantity}${row.unit ? ` ${row.unit}` : ''}${row.category ? ` · ${row.category}` : ''}`
				: row.category
					? `Category: ${row.category}`
					: 'Cupboard item',
			href: '/cupboard',
			score: Number(row.score ?? 0)
		}));
	}

	private async searchReceipts(
		userId: string,
		query: string,
		likeValue: string,
		limit: number,
		useTrigram: boolean
	): Promise<GlobalSearchItem[]> {
		const scoreExpr = useTrigram
			? sql`
				(
					COALESCE(ts_rank(
						to_tsvector('english', COALESCE(r.store_name, '') || ' ' || COALESCE(string_agg(ri.normalized_name, ' '), '')),
						websearch_to_tsquery('english', ${query})
					), 0)
					+ COALESCE(similarity(COALESCE(r.store_name, ''), ${query}), 0) * 0.65
					+ COALESCE(MAX(similarity(COALESCE(ri.normalized_name, ''), ${query})), 0) * 0.4
				)
			`
			: sql`
				COALESCE(ts_rank(
					to_tsvector('english', COALESCE(r.store_name, '') || ' ' || COALESCE(string_agg(ri.normalized_name, ' '), '')),
					websearch_to_tsquery('english', ${query})
				), 0)
			`;

		const rows = await this.db.execute<{
			id: string;
			store_name: string | null;
			purchase_date: Date | null;
			total_amount: string | null;
			matched_items: string | null;
			score: number;
		}>(sql`
			SELECT
				r.id,
				r.store_name,
				r.purchase_date,
				r.total_amount::text AS total_amount,
				STRING_AGG(DISTINCT ri.normalized_name, ', ') FILTER (WHERE ri.normalized_name ILIKE ${likeValue}) AS matched_items,
				${scoreExpr} AS score
			FROM receipts r
			LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
			WHERE r.user_id = ${userId}
				AND (
					COALESCE(r.store_name, '') ILIKE ${likeValue}
					OR COALESCE(ri.normalized_name, '') ILIKE ${likeValue}
					OR to_tsvector('english', COALESCE(r.store_name, '') || ' ' || COALESCE(ri.normalized_name, '')) @@ websearch_to_tsquery('english', ${query})
				)
			GROUP BY r.id
			ORDER BY score DESC, r.created_at DESC
			LIMIT ${limit}
		`);

		return rows.rows.map((row) => {
			const purchaseDate = row.purchase_date
				? new Date(row.purchase_date).toLocaleDateString()
				: null;
			const matchedItems = row.matched_items ? `Items: ${row.matched_items}` : null;
			const price = row.total_amount ? `Total: ${row.total_amount}` : null;

			return {
				id: row.id,
				title: row.store_name || 'Receipt',
				subtitle:
					matchedItems ||
					[purchaseDate, price].filter((value) => Boolean(value)).join(' · ') ||
					'Receipt',
				href: `/receipts/${row.id}`,
				score: Number(row.score ?? 0)
			};
		});
	}
}
