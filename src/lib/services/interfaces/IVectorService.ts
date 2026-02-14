export interface VectorSearchResult {
  id: string;
  recipeTitle: string;
  contentChunk: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface IVectorService {
  /**
   * Search for similar vectors in the database
   * @param embedding - Query embedding vector
   * @param limit - Maximum number of results (default: 5)
   * @param threshold - Minimum similarity threshold (default: 0.7)
   * @returns Similar documents with similarity scores
   */
  search(
    embedding: number[],
    limit?: number,
    threshold?: number,
  ): Promise<VectorSearchResult[]>;

  /**
   * Search using text query (will embed internally)
   * @param query - Text query to search for
   * @param limit - Maximum number of results
   * @returns Similar documents with similarity scores
   */
  searchByText(query: string, limit?: number): Promise<VectorSearchResult[]>;

  /**
   * Upsert a document with its embedding
   * @param id - Document ID
   * @param recipeTitle - Recipe title
   * @param content - Text content to embed and store
   * @param metadata - Optional metadata
   */
  upsert(
    id: string,
    recipeTitle: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Delete a document by ID
   * @param id - Document ID to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Batch upsert multiple documents
   * @param documents - Array of documents to upsert
   */
  batchUpsert(
    documents: Array<{
      id: string;
      recipeTitle: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void>;
}
