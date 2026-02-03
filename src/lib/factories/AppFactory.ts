import { env } from "$env/dynamic/private";
import { db } from "$db/client";
import {
  MinioStorageService,
  FileSystemStorageService,
  NormalizationService,
  Auth0OAuthService,
  MistralOcrService,
  MockOcrService,
  GeminiLlmService,
  GeminiImageService,
  GeminiProductNormalizationService,
  PgVectorService,
  JobQueue,
  PantryService,
  TasteProfileService,
  DashboardService,
  type IStorageService,
  type INormalizationService,
  type IOcrService,
  type ILlmService,
  type IImageGenService,
  type IVectorService,
  type IProductNormalizationService,
  type IOAuthService,
  type IPantryService,
  type ITasteProfileService,
  type IDashboardService,
} from "$services";
import {
  UserRepository,
  SessionRepository,
  UserPreferencesRepository,
  ReceiptRepository,
  ReceiptItemRepository,
  RecipeRepository,
  RecipeIngredientRepository,
  SavedRecipeRepository,
  ShoppingListRepository,
  ShoppingListItemRepository,
  PurchaseHistoryRepository,
  UserDietaryProfileRepository,
  UserAllergyRepository,
  UserIngredientPreferenceRepository,
  UserCuisinePreferenceRepository,
  type IUserRepository,
  type ISessionRepository,
  type IUserPreferencesRepository,
  type IReceiptRepository,
  type IReceiptItemRepository,
  type IRecipeRepository,
  type IRecipeIngredientRepository,
  type ISavedRecipeRepository,
  type IShoppingListRepository,
  type IShoppingListItemRepository,
  type IPurchaseHistoryRepository,
  type IUserDietaryProfileRepository,
  type IUserAllergyRepository,
  type IUserIngredientPreferenceRepository,
  type IUserCuisinePreferenceRepository,
} from "$repositories";

// Infrastructure Services
let storageService: IStorageService | null = null;
let normalizationService: INormalizationService | null = null;
let productNormalizationService: IProductNormalizationService | null = null;
let ocrService: IOcrService | null = null;
let llmService: ILlmService | null = null;
let imageGenService: IImageGenService | null = null;
let vectorService: IVectorService | null = null;
let jobQueue: JobQueue | null = null;

// Domain Services - Using IOAuthService as the auth interface
let oauthService: IOAuthService | null = null;
let pantryService: IPantryService | null = null;
let tasteProfileService: ITasteProfileService | null = null;
let dashboardService: IDashboardService | null = null;

// Repositories
let userRepository: IUserRepository | null = null;
let sessionRepository: ISessionRepository | null = null;
let userPreferencesRepository: IUserPreferencesRepository | null = null;
let receiptRepository: IReceiptRepository | null = null;
let receiptItemRepository: IReceiptItemRepository | null = null;
let recipeRepository: IRecipeRepository | null = null;
let recipeIngredientRepository: IRecipeIngredientRepository | null = null;
let savedRecipeRepository: ISavedRecipeRepository | null = null;
let shoppingListRepository: IShoppingListRepository | null = null;
let shoppingListItemRepository: IShoppingListItemRepository | null = null;
let purchaseHistoryRepository: IPurchaseHistoryRepository | null = null;
let userDietaryProfileRepository: IUserDietaryProfileRepository | null = null;
let userAllergyRepository: IUserAllergyRepository | null = null;
let userIngredientPreferenceRepository: IUserIngredientPreferenceRepository | null = null;
let userCuisinePreferenceRepository: IUserCuisinePreferenceRepository | null = null;

/**
 * Factory for creating and managing service and repository instances
 * Uses singleton pattern to ensure single instances per service
 */
export class AppFactory {
  // Infrastructure Services
  static getStorageService(): IStorageService {
    if (!storageService) {
      storageService = new FileSystemStorageService();
    }
    return storageService;
  }

  static getNormalizationService(): INormalizationService {
    if (!normalizationService) {
      normalizationService = new NormalizationService();
    }
    return normalizationService;
  }

  static getProductNormalizationService(): IProductNormalizationService {
    if (!productNormalizationService) {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      productNormalizationService = new GeminiProductNormalizationService(apiKey);
    }
    return productNormalizationService;
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
        env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
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
        env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
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

  // Domain Services - Auth now uses OAuth2/Auth0
  static getOAuthService(): IOAuthService {
    if (!oauthService) {
      const domain = env.OAUTH_DOMAIN;
      const clientId = env.OAUTH_CLIENT_ID;
      const clientSecret = env.OAUTH_CLIENT_SECRET;
      
      if (!domain || !clientId || !clientSecret) {
        throw new Error(
          "OAuth environment variables (OAUTH_DOMAIN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET) are required"
        );
      }

      oauthService = new Auth0OAuthService(
        AppFactory.getUserRepository(),
        AppFactory.getSessionRepository(),
        AppFactory.getUserPreferencesRepository(),
        {
          domain,
          clientId,
          clientSecret,
          callbackUrl: env.OAUTH_CALLBACK_URL || "/callback",
        }
      );
    }
    return oauthService;
  }

  // Backwards compatibility - AuthService is now OAuth-based
  static getAuthService(): IOAuthService {
    return AppFactory.getOAuthService();
  }

  static getPantryService(): IPantryService {
    if (!pantryService) {
      pantryService = new PantryService();
    }
    return pantryService;
  }

  static getTasteProfileService(): ITasteProfileService {
    if (!tasteProfileService) {
      tasteProfileService = new TasteProfileService(
        AppFactory.getUserDietaryProfileRepository(),
        AppFactory.getUserAllergyRepository(),
        AppFactory.getUserIngredientPreferenceRepository(),
        AppFactory.getUserCuisinePreferenceRepository(),
        AppFactory.getRecipeRepository(),
        AppFactory.getRecipeIngredientRepository()
      );
    }
    return tasteProfileService;
  }

  static getDashboardService(): IDashboardService {
    if (!dashboardService) {
      dashboardService = new DashboardService(
        AppFactory.getReceiptRepository(),
        AppFactory.getRecipeRepository(),
        AppFactory.getSavedRecipeRepository(),
        AppFactory.getShoppingListRepository(),
        AppFactory.getPantryService()
      );
    }
    return dashboardService;
  }

  // Repositories
  static getUserRepository(): IUserRepository {
    if (!userRepository) {
      userRepository = new UserRepository(db);
    }
    return userRepository;
  }

  static getSessionRepository(): ISessionRepository {
    if (!sessionRepository) {
      sessionRepository = new SessionRepository(db);
    }
    return sessionRepository;
  }

  static getUserPreferencesRepository(): IUserPreferencesRepository {
    if (!userPreferencesRepository) {
      userPreferencesRepository = new UserPreferencesRepository(db);
    }
    return userPreferencesRepository;
  }

  static getReceiptRepository(): IReceiptRepository {
    if (!receiptRepository) {
      receiptRepository = new ReceiptRepository(db);
    }
    return receiptRepository;
  }

  static getReceiptItemRepository(): IReceiptItemRepository {
    if (!receiptItemRepository) {
      receiptItemRepository = new ReceiptItemRepository(db);
    }
    return receiptItemRepository;
  }

  static getRecipeRepository(): IRecipeRepository {
    if (!recipeRepository) {
      recipeRepository = new RecipeRepository(db);
    }
    return recipeRepository;
  }

  static getRecipeIngredientRepository(): IRecipeIngredientRepository {
    if (!recipeIngredientRepository) {
      recipeIngredientRepository = new RecipeIngredientRepository(db);
    }
    return recipeIngredientRepository;
  }

  static getSavedRecipeRepository(): ISavedRecipeRepository {
    if (!savedRecipeRepository) {
      savedRecipeRepository = new SavedRecipeRepository(db);
    }
    return savedRecipeRepository;
  }

  static getShoppingListRepository(): IShoppingListRepository {
    if (!shoppingListRepository) {
      shoppingListRepository = new ShoppingListRepository(db);
    }
    return shoppingListRepository;
  }

  static getShoppingListItemRepository(): IShoppingListItemRepository {
    if (!shoppingListItemRepository) {
      shoppingListItemRepository = new ShoppingListItemRepository(db);
    }
    return shoppingListItemRepository;
  }

  static getPurchaseHistoryRepository(): IPurchaseHistoryRepository {
    if (!purchaseHistoryRepository) {
      purchaseHistoryRepository = new PurchaseHistoryRepository(db);
    }
    return purchaseHistoryRepository;
  }

  static getUserDietaryProfileRepository(): IUserDietaryProfileRepository {
    if (!userDietaryProfileRepository) {
      userDietaryProfileRepository = new UserDietaryProfileRepository(db);
    }
    return userDietaryProfileRepository;
  }

  static getUserAllergyRepository(): IUserAllergyRepository {
    if (!userAllergyRepository) {
      userAllergyRepository = new UserAllergyRepository(db);
    }
    return userAllergyRepository;
  }

  static getUserIngredientPreferenceRepository(): IUserIngredientPreferenceRepository {
    if (!userIngredientPreferenceRepository) {
      userIngredientPreferenceRepository = new UserIngredientPreferenceRepository(db);
    }
    return userIngredientPreferenceRepository;
  }

  static getUserCuisinePreferenceRepository(): IUserCuisinePreferenceRepository {
    if (!userCuisinePreferenceRepository) {
      userCuisinePreferenceRepository = new UserCuisinePreferenceRepository(db);
    }
    return userCuisinePreferenceRepository;
  }

  /**
   * Reset all singleton instances (useful for testing)
   */
  static reset(): void {
    // Infrastructure Services
    storageService = null;
    normalizationService = null;
    productNormalizationService = null;
    ocrService = null;
    llmService = null;
    imageGenService = null;
    vectorService = null;
    jobQueue = null;

    // Domain Services
    oauthService = null;
    pantryService = null;
    tasteProfileService = null;
    dashboardService = null;

    // Repositories
    userRepository = null;
    sessionRepository = null;
    userPreferencesRepository = null;
    receiptRepository = null;
    receiptItemRepository = null;
    recipeRepository = null;
    recipeIngredientRepository = null;
    savedRecipeRepository = null;
    shoppingListRepository = null;
    shoppingListItemRepository = null;
    purchaseHistoryRepository = null;
    userDietaryProfileRepository = null;
    userAllergyRepository = null;
    userIngredientPreferenceRepository = null;
    userCuisinePreferenceRepository = null;
  }
}
