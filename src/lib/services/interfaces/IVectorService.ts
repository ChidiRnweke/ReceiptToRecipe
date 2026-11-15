export interface VectorSearchResult {
	id: string;
	recipeTitle: string;
	contentChunk: string;
	similarity: number;
	metadata?: Record<string, unknown>;
}

/** Similarity search over the shared cookbook catalog; the importer writes the embeddings. */
export interface IVectorService {
	/**
	 * Search for similar vectors in the database
	 * @param embedding - Query embedding vector
	 * @param limit - Maximum number of results (default: 5)
	 * @param threshold - Minimum similarity threshold (default: 0.7)
	 * @returns Similar documents with similarity scores
	 */
	search(embedding: number[], limit?: number, threshold?: number): Promise<VectorSearchResult[]>;

	/**
	 * Search using text query (will embed internally)
	 * @param query - Text query to search for
	 * @param limit - Maximum number of results
	 * @returns Similar documents with similarity scores
	 */
	searchByText(query: string, limit?: number): Promise<VectorSearchResult[]>;
}
