import { db } from '$db/client';
import { cookbookEmbeddings } from '$db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import type { IVectorService, VectorSearchResult } from './interfaces';
import type { ILlmService } from './interfaces';

export class PgVectorService implements IVectorService {
	private llmService: ILlmService;

	constructor(llmService: ILlmService) {
		this.llmService = llmService;
	}

	async search(
		embedding: number[],
		limit: number = 5,
		threshold: number = 0.7
	): Promise<VectorSearchResult[]> {
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

		return results.map((r) => ({
			id: r.id,
			recipeTitle: r.recipeTitle,
			contentChunk: r.contentChunk,
			similarity: r.similarity,
			metadata: r.metadata as Record<string, unknown> | undefined
		}));
	}

	async searchByText(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
		const embedding = await this.llmService.embed(query);
		return this.search(embedding, limit);
	}

	async upsert(
		id: string,
		recipeTitle: string,
		content: string,
		metadata?: Record<string, unknown>
	): Promise<void> {
		const embedding = await this.llmService.embed(content);
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
