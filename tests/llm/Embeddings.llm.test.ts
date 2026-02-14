/// <reference types="vitest/globals" />
import {
  describeLLM,
  OPENROUTER_API_KEY,
  CHEAP_CHAT_MODEL,
  withRetry,
} from "./setup";
import { SmartCulinaryIntelligence } from "../../src/lib/services/SmartCulinaryIntelligence";

/**
 * Dedicated embedding tests that exercise the embed() method more deeply.
 * These validate that the embedding model produces useful vectors for
 * the RAG (cookbook) functionality in PgVectorService.
 */
describeLLM("Embeddings for RAG (LLM Integration)", () => {
  let service: SmartCulinaryIntelligence;

  beforeAll(() => {
    service = new SmartCulinaryIntelligence(
      OPENROUTER_API_KEY,
      CHEAP_CHAT_MODEL,
    );
  });

  function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      norm1 = 0,
      norm2 = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      norm1 += a[i] ** 2;
      norm2 += b[i] ** 2;
    }
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  it("should produce embeddings that group similar recipes together", async () => {
    const [pastaEmb, pizzaEmb, sushiEmb] = await Promise.all([
      withRetry(() =>
        service.embed("Classic spaghetti carbonara with pancetta and egg"),
      ),
      withRetry(() =>
        service.embed("Homemade margherita pizza with mozzarella and basil"),
      ),
      withRetry(() =>
        service.embed("Traditional Japanese sushi roll with fresh salmon"),
      ),
    ]);

    // Italian recipes should be more similar to each other than to Japanese
    const pastaVsPizza = cosineSimilarity(pastaEmb, pizzaEmb);
    const pastaVsSushi = cosineSimilarity(pastaEmb, sushiEmb);

    expect(pastaVsPizza).toBeGreaterThan(pastaVsSushi);
  });

  it("should distinguish between cooking techniques", async () => {
    const [grilled, fried, baked] = await Promise.all([
      withRetry(() => service.embed("grilled chicken with herbs")),
      withRetry(() => service.embed("deep fried chicken wings")),
      withRetry(() => service.embed("baked chicken casserole")),
    ]);

    // All should be somewhat similar (all chicken)
    const grilledVsFried = cosineSimilarity(grilled, fried);
    const grilledVsBaked = cosineSimilarity(grilled, baked);

    expect(grilledVsFried).toBeGreaterThan(0.5);
    expect(grilledVsBaked).toBeGreaterThan(0.5);
  });

  it("should produce deterministic embeddings for the same input", async () => {
    const text = "Lemon garlic butter shrimp pasta";
    const [emb1, emb2] = await Promise.all([
      withRetry(() => service.embed(text)),
      withRetry(() => service.embed(text)),
    ]);

    const similarity = cosineSimilarity(emb1, emb2);
    // Same input should produce near-identical embeddings
    expect(similarity).toBeGreaterThan(0.99);
  });

  it("should handle short and long texts", async () => {
    const [shortEmb, longEmb] = await Promise.all([
      withRetry(() => service.embed("soup")),
      withRetry(() =>
        service.embed(
          "This is a comprehensive recipe for a traditional French onion soup that involves " +
            "caramelizing onions slowly for over an hour, preparing a rich beef broth, " +
            "toasting baguette slices, and gratinating with Gruyere cheese under a broiler " +
            "until golden and bubbly. Serve immediately in oven-safe crocks.",
        ),
      ),
    ]);

    // Both should produce valid embeddings of the same dimension
    expect(shortEmb.length).toBe(longEmb.length);
    expect(shortEmb.length).toBe(1536);

    // They should have some similarity (both about soup)
    const similarity = cosineSimilarity(shortEmb, longEmb);
    expect(similarity).toBeGreaterThan(0.3);
  });
});
