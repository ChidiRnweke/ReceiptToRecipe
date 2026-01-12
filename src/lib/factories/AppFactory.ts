import { env } from "$env/dynamic/private";
import {
  MinioStorageService,
  NormalizationService,
  AuthService,
  MistralOcrService,
  MockOcrService,
  GeminiLlmService,
  GeminiImageService,
  PgVectorService,
  JobQueue,
  type IStorageService,
  type INormalizationService,
  type IOcrService,
  type ILlmService,
  type IImageGenService,
  type IVectorService,
} from "$services";

// Singleton instances
let storageService: IStorageService | null = null;
let normalizationService: INormalizationService | null = null;
let authService: AuthService | null = null;
let ocrService: IOcrService | null = null;
let llmService: ILlmService | null = null;
let imageGenService: IImageGenService | null = null;
let vectorService: IVectorService | null = null;
let jobQueue: JobQueue | null = null;

/**
 * Factory for creating and managing service instances
 * Uses singleton pattern to ensure single instances per service
 */
export class AppFactory {
  static getStorageService(): IStorageService {
    if (!storageService) {
      storageService = new MinioStorageService({
        endPoint: env.MINIO_ENDPOINT || "localhost",
        port: parseInt(env.MINIO_PORT || "9000"),
        useSSL: env.MINIO_USE_SSL === "true",
        accessKey: env.MINIO_ACCESS_KEY || "minioadmin",
        secretKey: env.MINIO_SECRET_KEY || "minioadmin",
        bucket: env.MINIO_BUCKET || "r2r-images",
      });
    }
    return storageService;
  }

  static getNormalizationService(): INormalizationService {
    if (!normalizationService) {
      normalizationService = new NormalizationService();
    }
    return normalizationService;
  }

  static getAuthService(): AuthService {
    if (!authService) {
      authService = new AuthService();
    }
    return authService;
  }

  static getOcrService(): IOcrService {
    if (!ocrService) {
      const apiKey = env.MISTRAL_API_KEY;
      ocrService = apiKey
        ? new MistralOcrService(apiKey)
        : new MockOcrService();
    }
    return ocrService;
  }

  static getLlmService(): ILlmService {
    if (!llmService) {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      llmService = new GeminiLlmService(
        apiKey,
        env.GEMINI_MODEL || "gemini-2.5-flash",
        env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
      );
    }
    return llmService;
  }

  static getImageGenService(): IImageGenService {
    if (!imageGenService) {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      imageGenService = new GeminiImageService(
        apiKey,
        env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image"
      );
    }
    return imageGenService;
  }

  static getVectorService(): IVectorService {
    if (!vectorService) {
      vectorService = new PgVectorService(AppFactory.getLlmService());
    }
    return vectorService;
  }

  static getJobQueue(): JobQueue {
    if (!jobQueue) {
      const concurrency = parseInt(env.JOB_CONCURRENCY || "2");
      jobQueue = new JobQueue(Number.isFinite(concurrency) ? concurrency : 2);
    }
    return jobQueue;
  }

  /**
   * Reset all singleton instances (useful for testing)
   */
  static reset(): void {
    storageService = null;
    normalizationService = null;
    authService = null;
    ocrService = null;
    llmService = null;
    imageGenService = null;
    vectorService = null;
    jobQueue = null;
  }
}
