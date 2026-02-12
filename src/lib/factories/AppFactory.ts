import { ConfigService } from "$services/ConfigService";
import { getDb } from "$db/client";
import {
  MinioStorageService,
  FileSystemStorageService,
  NormalizationService,
  AuthentikOAuthService,
  NativeReceiptExtractor,
  MockOcrService,
  SmartCulinaryIntelligence,
  SmartImageGenerator,
  SmartProductNormalizer,
  PgVectorService,
  JobQueue,
  PantryService,
  TasteProfileService,
  DashboardService,
  type IStorageService,
  type INormalizationService,
  type IReceiptExtractor,
  type ICulinaryIntelligence,
  type IImageGenerator,
  type IVectorService,
  type IProductNormalizer,
  type IOAuthService,
  type IPantryService,
  type ITasteProfileService,
  type IDashboardService,
} from "$services";
import { RecipeController, PreferencesController, ReceiptController, PantryController, ShoppingListController } from "$controllers";
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
let productNormalizer: IProductNormalizer | null = null;
let receiptExtractor: IReceiptExtractor | null = null;
let culinaryIntelligence: ICulinaryIntelligence | null = null;
let imageGenerator: IImageGenerator | null = null;
let vectorService: IVectorService | null = null;
let jobQueue: JobQueue | null = null;

// Controllers
let recipeController: RecipeController | null = null;
let preferencesController: PreferencesController | null = null;
let receiptController: ReceiptController | null = null;
let pantryController: PantryController | null = null;
let shoppingListController: ShoppingListController | null = null;

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
let userIngredientPreferenceRepository: IUserIngredientPreferenceRepository | null =
  null;
let userCuisinePreferenceRepository: IUserCuisinePreferenceRepository | null =
  null;

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

  static getProductNormalizer(): IProductNormalizer {
    if (!productNormalizer) {
      const apiKey = ConfigService.get("OPENROUTER_API_KEY");
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is required");
      }
      productNormalizer = new SmartProductNormalizer(apiKey);
    }
    return productNormalizer;
  }

  // Deprecated alias for backwards compatibility
  static getProductNormalizationService(): IProductNormalizer {
    return AppFactory.getProductNormalizer();
  }

  static getReceiptExtractor(): IReceiptExtractor {
    if (!receiptExtractor) {
      const apiKey = ConfigService.get("MISTRAL_API_KEY");
      receiptExtractor = apiKey
        ? new NativeReceiptExtractor(apiKey)
        : new MockOcrService();
    }
    return receiptExtractor;
  }

  // Deprecated alias
  static getOcrService(): IReceiptExtractor {
    return AppFactory.getReceiptExtractor();
  }

  static getCulinaryIntelligence(): ICulinaryIntelligence {
    if (!culinaryIntelligence) {
      const apiKey = ConfigService.get("OPENROUTER_API_KEY");
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is required");
      }
      culinaryIntelligence = new SmartCulinaryIntelligence(
        apiKey,
        ConfigService.get("OPENROUTER_MODEL") ||
          "google/gemini-3-flash-preview",
      );
    }
    return culinaryIntelligence;
  }

  // Deprecated alias
  static getLlmService(): ICulinaryIntelligence {
    return AppFactory.getCulinaryIntelligence();
  }

  static getImageGenerator(): IImageGenerator {
    if (!imageGenerator) {
      const apiKey = ConfigService.get("OPENROUTER_API_KEY");
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is required");
      }
      imageGenerator = new SmartImageGenerator(
        apiKey,
        ConfigService.get("OPENROUTER_IMAGE_MODEL") ||
          "google/gemini-2.5-flash-image",
      );
    }
    return imageGenerator;
  }

  // Deprecated alias
  static getImageGenService(): IImageGenerator {
    return AppFactory.getImageGenerator();
  }

  static getVectorService(): IVectorService {
    if (!vectorService) {
      vectorService = new PgVectorService(AppFactory.getCulinaryIntelligence());
    }
    return vectorService;
  }

  static getJobQueue(): JobQueue {
    if (!jobQueue) {
      const concurrency = parseInt(ConfigService.get("JOB_CONCURRENCY") || "2");
      jobQueue = new JobQueue(Number.isFinite(concurrency) ? concurrency : 2);
    }
    return jobQueue;
  }

  // Domain Services - Auth now uses OAuth2/Auth0
  static getOAuthService(): IOAuthService {
    if (!oauthService) {
      const domain = ConfigService.get("OAUTH_DOMAIN");
      const clientId = ConfigService.get("OAUTH_CLIENT_ID");
      const clientSecret = ConfigService.get("OAUTH_CLIENT_SECRET");

      if (!domain || !clientId || !clientSecret) {
        throw new Error(
          "OAuth environment variables (OAUTH_DOMAIN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET) are required",
        );
      }

      oauthService = new AuthentikOAuthService(
        AppFactory.getUserRepository(),
        AppFactory.getSessionRepository(),
        AppFactory.getUserPreferencesRepository(),
        {
          domain,
          clientId,
          clientSecret,
          callbackUrl: ConfigService.get("OAUTH_CALLBACK_URL") || "/callback",
          slug: ConfigService.get("OAUTH_APP_SLUG"),
        },
      );
    }
    return oauthService!;
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
        AppFactory.getRecipeIngredientRepository(),
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
        AppFactory.getPantryService(),
        AppFactory.getPurchaseHistoryRepository(),
        AppFactory.getReceiptItemRepository(),
        AppFactory.getShoppingListController(),
      );
    }
    return dashboardService;
  }

  // Controllers
  static getRecipeController(): RecipeController {
    if (!recipeController) {
      recipeController = new RecipeController(
        AppFactory.getCulinaryIntelligence(),
        AppFactory.getImageGenerator(),
        AppFactory.getVectorService(),
        AppFactory.getTasteProfileService(),
        AppFactory.getRecipeRepository(),
        AppFactory.getRecipeIngredientRepository(),
        AppFactory.getSavedRecipeRepository(),
        AppFactory.getUserPreferencesRepository(),
        AppFactory.getReceiptItemRepository(),
        AppFactory.getJobQueue(),
      );
    }
    return recipeController;
  }

  static getPreferencesController(): PreferencesController {
    if (!preferencesController) {
      preferencesController = new PreferencesController(
        AppFactory.getUserPreferencesRepository(),
      );
    }
    return preferencesController;
  }

  static getReceiptController(): ReceiptController {
    if (!receiptController) {
      receiptController = new ReceiptController(
        AppFactory.getStorageService(),
        AppFactory.getReceiptExtractor(),
        AppFactory.getNormalizationService(),
        AppFactory.getProductNormalizer(),
        AppFactory.getPantryService(),
        AppFactory.getReceiptRepository(),
        AppFactory.getReceiptItemRepository(),
        AppFactory.getPurchaseHistoryRepository(),
        AppFactory.getJobQueue(),
      );
    }
    return receiptController;
  }

  static getPantryController(): PantryController {
    if (!pantryController) {
      pantryController = new PantryController(
        AppFactory.getPantryService(),
        AppFactory.getPurchaseHistoryRepository(),
        AppFactory.getReceiptItemRepository(),
      );
    }
    return pantryController;
  }

  static getShoppingListController(): ShoppingListController {
    if (!shoppingListController) {
      shoppingListController = new ShoppingListController(
        AppFactory.getShoppingListRepository(),
        AppFactory.getShoppingListItemRepository(),
        AppFactory.getPurchaseHistoryRepository(),
        AppFactory.getRecipeIngredientRepository(),
        AppFactory.getReceiptItemRepository(),
      );
    }
    return shoppingListController;
  }

  // Repositories
  static getUserRepository(): IUserRepository {
    if (!userRepository) {
      userRepository = new UserRepository(getDb());
    }
    return userRepository;
  }

  static getSessionRepository(): ISessionRepository {
    if (!sessionRepository) {
      sessionRepository = new SessionRepository(getDb());
    }
    return sessionRepository;
  }

  static getUserPreferencesRepository(): IUserPreferencesRepository {
    if (!userPreferencesRepository) {
      userPreferencesRepository = new UserPreferencesRepository(getDb());
    }
    return userPreferencesRepository;
  }

  static getReceiptRepository(): IReceiptRepository {
    if (!receiptRepository) {
      receiptRepository = new ReceiptRepository(getDb());
    }
    return receiptRepository;
  }

  static getReceiptItemRepository(): IReceiptItemRepository {
    if (!receiptItemRepository) {
      receiptItemRepository = new ReceiptItemRepository(getDb());
    }
    return receiptItemRepository;
  }

  static getRecipeRepository(): IRecipeRepository {
    if (!recipeRepository) {
      recipeRepository = new RecipeRepository(getDb());
    }
    return recipeRepository;
  }

  static getRecipeIngredientRepository(): IRecipeIngredientRepository {
    if (!recipeIngredientRepository) {
      recipeIngredientRepository = new RecipeIngredientRepository(getDb());
    }
    return recipeIngredientRepository;
  }

  static getSavedRecipeRepository(): ISavedRecipeRepository {
    if (!savedRecipeRepository) {
      savedRecipeRepository = new SavedRecipeRepository(getDb());
    }
    return savedRecipeRepository;
  }

  static getShoppingListRepository(): IShoppingListRepository {
    if (!shoppingListRepository) {
      shoppingListRepository = new ShoppingListRepository(getDb());
    }
    return shoppingListRepository;
  }

  static getShoppingListItemRepository(): IShoppingListItemRepository {
    if (!shoppingListItemRepository) {
      shoppingListItemRepository = new ShoppingListItemRepository(getDb());
    }
    return shoppingListItemRepository;
  }

  static getPurchaseHistoryRepository(): IPurchaseHistoryRepository {
    if (!purchaseHistoryRepository) {
      purchaseHistoryRepository = new PurchaseHistoryRepository(getDb());
    }
    return purchaseHistoryRepository;
  }

  static getUserDietaryProfileRepository(): IUserDietaryProfileRepository {
    if (!userDietaryProfileRepository) {
      userDietaryProfileRepository = new UserDietaryProfileRepository(getDb());
    }
    return userDietaryProfileRepository;
  }

  static getUserAllergyRepository(): IUserAllergyRepository {
    if (!userAllergyRepository) {
      userAllergyRepository = new UserAllergyRepository(getDb());
    }
    return userAllergyRepository;
  }

  static getUserIngredientPreferenceRepository(): IUserIngredientPreferenceRepository {
    if (!userIngredientPreferenceRepository) {
      userIngredientPreferenceRepository =
        new UserIngredientPreferenceRepository(getDb());
    }
    return userIngredientPreferenceRepository;
  }

  static getUserCuisinePreferenceRepository(): IUserCuisinePreferenceRepository {
    if (!userCuisinePreferenceRepository) {
      userCuisinePreferenceRepository = new UserCuisinePreferenceRepository(
        getDb(),
      );
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
    productNormalizer = null;
    receiptExtractor = null;
    culinaryIntelligence = null;
    imageGenerator = null;
    vectorService = null;
    jobQueue = null;

    // Domain Services
    oauthService = null;
    pantryService = null;
    tasteProfileService = null;
    dashboardService = null;

    // Controllers
    recipeController = null;
    preferencesController = null;
    receiptController = null;
    pantryController = null;
    shoppingListController = null;

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
