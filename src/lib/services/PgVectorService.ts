import { getDb } from '$db/client';
import { cookbookEmbeddings } from '$db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import type { IVectorService, VectorSearchResult } from './interfaces';
import type { ICulinaryIntelligence } from './interfaces';
import type { PgDatabase } from 'drizzle-orm/pg-core';

export class PgVectorService implements IVectorService {
	private culinaryIntelligence: ICulinaryIntelligence;

	constructor(culinaryIntelligence: ICulinaryIntelligence) {
		this.culinaryIntelligence = culinaryIntelligence;
	}

	async search(
		embedding: number[],
		limit: number = 5,
		threshold: number = 0.7
	): Promise<VectorSearchResult[]> {
		const db = getDb();
		if (!db) throw new Error('Database not initialized');

		// Convert embedding array to pgvector format
		const embeddingStr = `[${embedding.join(',')}]`;

		// Use cosine distance for similarity search
		const results = await db
			.select({
				id: cookbookEmbeddings.id,
				recipeTitle: cookbookEmbeddings.recipeTitle,
				contentChunk: cookbookEmbeddings.contentChunk,
				metadata: cookbookEmbeddings.metadata,
				similarity: sql<number>`1 - (${cookbookEmbeddings.embedding} <=> ${embeddingStr}::vector)`
			})
			.from(cookbookEmbeddings)
			.where(sql`1 - (${cookbookEmbeddings.embedding} <=> ${embeddingStr}::vector) >= ${threshold}`)
			.orderBy(desc(sql`1 - (${cookbookEmbeddings.embedding} <=> ${embeddingStr}::vector)`))
			.limit(limit);

		return results.map((r: any) => ({
			id: r.id,
			recipeTitle: r.recipeTitle,
			contentChunk: r.contentChunk,
			similarity: r.similarity,
			metadata: r.metadata as Record<string, unknown> | undefined
		}));
	}

	async searchByText(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
		const embedding = await this.culinaryIntelligence.embed(query);
		return this.search(embedding, limit);
	}

	async upsert(
		id: string,
		recipeTitle: string,
		content: string,
		metadata?: Record<string, unknown>
	): Promise<void> {
		const db = getDb();
		if (!db) throw new Error('Database not initialized');

		const embedding = await this.culinaryIntelligence.embed(content);
		const embeddingStr = `[${embedding.join(',')}]`;

		await db
			.insert(cookbookEmbeddings)
			.values({
				id,
				recipeTitle,
				contentChunk: content,
				embedding: sql`${embeddingStr}::vector`,
				metadata: metadata || {}
			})
			.onConflictDoUpdate({
				target: cookbookEmbeddings.id,
				set: {
					recipeTitle,
					contentChunk: content,
					embedding: sql`${embeddingStr}::vector`,
					metadata: metadata || {}
				}
			});
	}

	async delete(id: string): Promise<void> {
		const db = getDb();
		if (!db) throw new Error('Database not initialized');
		await db.delete(cookbookEmbeddings).where(eq(cookbookEmbeddings.id, id));
	}

	async batchUpsert(
		documents: Array<{
			id: string;
			recipeTitle: string;
			content: string;
			metadata?: Record<string, unknown>;
		}>
	): Promise<void> {
		// Process in batches to avoid overwhelming the embedding API
		const batchSize = 10;

		for (let i = 0; i < documents.length; i += batchSize) {
			const batch = documents.slice(i, i + batchSize);

			await Promise.all(
				batch.map((doc) => this.upsert(doc.id, doc.recipeTitle, doc.content, doc.metadata))
			);
		}
	}
}
