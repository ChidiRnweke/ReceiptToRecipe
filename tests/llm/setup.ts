/// <reference types="vitest/globals" />
/**
 * LLM Integration Test Setup
 *
 * These tests make real API calls to OpenRouter with cheap models.
 * They require OPENROUTER_API_KEY to be set (loaded from .env).
 *
 * Run with: npm run test:llm
 */
import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// Use the cheapest viable models for integration tests
export const CHEAP_CHAT_MODEL = "google/gemini-2.0-flash-lite";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // used by embed() internally

export const hasApiKey = !!OPENROUTER_API_KEY;

/**
 * Helper to skip LLM test suites when no API key is available.
 * Returns a describe function that is either real or skipped.
 */
export const describeLLM = hasApiKey ? describe : describe.skip;

/**
 * Retry a function up to `retries` times with exponential backoff.
 * Useful for LLM calls that may hit transient API errors (502, rate limits).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
