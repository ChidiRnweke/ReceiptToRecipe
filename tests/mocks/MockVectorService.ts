import type { IVectorService, VectorSearchResult } from '../../src/lib/services/interfaces/IVectorService';

interface StoredDocument {
	id: string;
	recipeTitle: string;
	contentChunk: string;
	embedding: number[];
	metadata?: Record<string, unknown>;
}

/**
 * Mock implementation of IVectorService for testing
 * Stores documents in-memory with mock similarity calculation
 */
export class MockVectorService implements IVectorService {
	private documents = new Map<string, StoredDocument>();

	async search(embedding: number[], limit: number = 5, threshold: number = 0.7): Promise<VectorSearchResult[]> {
		const results: VectorSearchResult[] = [];
		
		for (const doc of this.documents.values()) {
			const similarity = this.calculateCosineSimilarity(embedding, doc.embedding);
			if (similarity >= threshold) {
				results.push({
					id: doc.id,
					recipeTitle: doc.recipeTitle,
					contentChunk: doc.contentChunk,
					similarity,
					metadata: doc.metadata
				});
			}
		}

		return results
			.sort((a, b) => b.similarity - a.similarity)
			.slice(0, limit);
	}

	async searchByText(query: string, limit?: number): Promise<VectorSearchResult[]> {
		// Generate a mock embedding from the query (simple hash-based approach)
		const mockEmbedding = this.generateMockEmbedding(query);
		return this.search(mockEmbedding, limit);
	}

	async upsert(
		id: string,
		recipeTitle: string,
		content: string,
		metadata?: Record<string, unknown>
	): Promise<void> {
		this.documents.set(id, {
			id,
			recipeTitle,
			contentChunk: content,
			embedding: this.generateMockEmbedding(content),
			metadata
		});
	}

	async delete(id: string): Promise<void> {
		this.documents.delete(id);
	}

	async batchUpsert(
		documents: Array<{
			id: string;
			recipeTitle: string;
			content: string;
			metadata?: Record<string, unknown>;
		}>
	): Promise<void> {
		for (const doc of documents) {
			await this.upsert(doc.id, doc.recipeTitle, doc.content, doc.metadata);
		}
	}

	// Helper methods
	private calculateCosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) return 0;
		
		let dotProduct = 0;
		let normA = 0;
		let normB = 0;
		
		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		
		if (normA === 0 || normB === 0) return 0;
		return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
	}

	private generateMockEmbedding(text: string): number[] {
		// Generate a deterministic mock embedding based on text
		// Using 768 dimensions to match typical embedding models
		const embedding: number[] = [];
		let hash = 0;
		
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		
		for (let i = 0; i < 768; i++) {
			// Generate pseudo-random values between -1 and 1
			const value = Math.sin(hash + i) * 0.5 + 0.1;
			embedding.push(value);
		}
		
		return embedding;
	}

	// Test helpers
	getStored(id: string): StoredDocument | undefined {
		return this.documents.get(id);
	}

	getAllStored(): StoredDocument[] {
		return Array.from(this.documents.values());
	}

	clear(): void {
		this.documents.clear();
	}
}
