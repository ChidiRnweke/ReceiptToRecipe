import { dev } from '$app/environment';
import type { ModelProvider } from '@openai/agents';
import { ConfigService } from '$services/ConfigService';
import { getDb } from '$db/client';
import {
	MinioStorageService,
	FileSystemStorageService,
	NormalizationService,
	AuthentikOAuthService,
	NativeReceiptExtractor,
	MockOcrService,
	SmartCulinaryIntelligence,
	SmartImageGenerator,
	LocalFluxImageGenerator,
	SeedPictureGenerator,
	OpenRouterPhotoJudge,
	RecipePictureService,
	CookbookService,
	type ICookbookService,
	type IPhotoJudge,
	type IRecipePictureService,
	SmartProductNormalizer,
	PgVectorService,
	JobQueue,
	TasteProfileService,
	NutritionService,
	HouseholdService,
	KitchenService,
	HabitService,
	PlanService,
	ShopService,
	type IShopService,
	RecipeBookService,
	HouseholdEventService,
	NeedsYouService,
	AgentService,
	AgentRunService,
	ActiveRuns,
	InProcessRunEventBus,
	DevScriptedModelProvider,
	openRouterModelProvider,
	type IAgentService,
	type IAgentRunService,
	type IHouseholdEventService,
	type INeedsYouService,
	type IStorageService,
	type INormalizationService,
	type IReceiptExtractor,
	type ICulinaryIntelligence,
	type IImageGenerator,
	type IVectorService,
	type IProductNormalizer,
	type IOAuthService,
	type ITasteProfileService,
	type INutritionService,
	type INotificationService,
	type IHouseholdService,
	type IKitchenService,
	type IHabitService,
	type IPlanService,
	type IRecipeBookService
} from '$services';
import { AppriseNotificationService, MockNotificationService } from '$services';
import {
	RecipeController,
	PreferencesController,
	ReceiptController,
	ShoppingListController,
	HouseholdController,
	KitchenController,
	TonightController,
	FrontDoorController,
	PlanController,
	ShopController,
	RecipesDoorController,
	UseItUpController,
	NeedsYouController,
	BasilController
} from '$controllers';
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
	CupboardItemRepository,
	MealLogRepository,
	PlannedMealRepository,
	UserDietaryProfileRepository,
	UserAllergyRepository,
	UserIngredientPreferenceRepository,
	UserCuisinePreferenceRepository,
	WaitlistRepository,
	HouseholdRepository,
	KitchenEventRepository,
	HabitAnswerRepository,
	RecipeStepRepository,
	CookbookRecipeRepository,
	type ICookbookRecipeRepository,
	HouseholdEventRepository,
	NeedsYouAnswerRepository,
	AgentConversationRepository,
	AgentMessageRepository,
	AgentSessionRepository,
	AgentActionRepository,
	AgentRunRepository,
	type IHouseholdEventRepository,
	type INeedsYouAnswerRepository,
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
	type ICupboardItemRepository,
	type IMealLogRepository,
	type IPlannedMealRepository,
	type IUserDietaryProfileRepository,
	type IUserAllergyRepository,
	type IUserIngredientPreferenceRepository,
	type IUserCuisinePreferenceRepository,
	type IWaitlistRepository,
	type IHouseholdRepository,
	type IKitchenEventRepository,
	type IHabitAnswerRepository,
	type IRecipeStepRepository
} from '$repositories';
import { agentToolbox } from './agent/agentTools';
import seedPictures from '../../../static/seed/recipes/credits.json';
import {
	chooseImageGenerator,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_LOCAL_FLUX_MODEL,
	type SeedPictureCatalog
} from '$services/recipes';

// Infrastructure Services
let storageService: IStorageService | null = null;
let normalizationService: INormalizationService | null = null;
let productNormalizer: IProductNormalizer | null = null;
let receiptExtractor: IReceiptExtractor | null = null;
let culinaryIntelligence: ICulinaryIntelligence | null = null;
let imageGenerator: IImageGenerator | null = null;
let photoJudge: IPhotoJudge | null = null;
let recipePictureService: IRecipePictureService | null = null;
let vectorService: IVectorService | null = null;
let jobQueue: JobQueue | null = null;

// Controllers
let recipeController: RecipeController | null = null;
let preferencesController: PreferencesController | null = null;
let receiptController: ReceiptController | null = null;
let useItUpController: UseItUpController | null = null;
let needsYouController: NeedsYouController | null = null;
let shoppingListController: ShoppingListController | null = null;
let householdController: HouseholdController | null = null;
let kitchenController: KitchenController | null = null;
let tonightController: TonightController | null = null;
let frontDoorController: FrontDoorController | null = null;
let planController: PlanController | null = null;
let shopController: ShopController | null = null;
let recipesDoorController: RecipesDoorController | null = null;
let basilController: BasilController | null = null;

// Domain Services - Using IOAuthService as the auth interface
let oauthService: IOAuthService | null = null;
let householdEventService: IHouseholdEventService | null = null;
let needsYouService: INeedsYouService | null = null;
let tasteProfileService: ITasteProfileService | null = null;
let nutritionService: INutritionService | null = null;
let householdService: IHouseholdService | null = null;
let kitchenService: IKitchenService | null = null;
let habitService: IHabitService | null = null;
let planService: IPlanService | null = null;
let shopService: IShopService | null = null;
let recipeBookService: IRecipeBookService | null = null;
let agentService: IAgentService | null = null;
let agentModels: { provider: ModelProvider; model: string } | null = null;
let agentRunService: IAgentRunService | null = null;

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
let cupboardItemRepository: ICupboardItemRepository | null = null;
let mealLogRepository: IMealLogRepository | null = null;
let plannedMealRepository: IPlannedMealRepository | null = null;
let userDietaryProfileRepository: IUserDietaryProfileRepository | null = null;
let userAllergyRepository: IUserAllergyRepository | null = null;
let userIngredientPreferenceRepository: IUserIngredientPreferenceRepository | null = null;
let userCuisinePreferenceRepository: IUserCuisinePreferenceRepository | null = null;
let waitlistRepository: IWaitlistRepository | null = null;
let householdRepository: IHouseholdRepository | null = null;
let kitchenEventRepository: IKitchenEventRepository | null = null;
let habitAnswerRepository: IHabitAnswerRepository | null = null;
let recipeStepRepository: IRecipeStepRepository | null = null;
let cookbookRecipeRepository: ICookbookRecipeRepository | null = null;
let cookbookService: ICookbookService | null = null;
let householdEventRepository: IHouseholdEventRepository | null = null;
let needsYouAnswerRepository: INeedsYouAnswerRepository | null = null;
let notificationService: INotificationService | null = null;

/**
 * Factory for creating and managing service and repository instances
 * Uses singleton pattern to ensure single instances per service
 */
export class AppFactory {
	// Infrastructure Services
	static getStorageService(): IStorageService {
		if (!storageService) {
			const endpoint = ConfigService.get('MINIO_ENDPOINT');
			const accessKey = ConfigService.get('MINIO_ACCESS_KEY');
			const secretKey = ConfigService.get('MINIO_SECRET_KEY');

			if (endpoint && accessKey && secretKey) {
				storageService = new MinioStorageService({
					endPoint: endpoint,
					port: parseInt(ConfigService.get('MINIO_PORT') || '9000'),
					useSSL: ConfigService.get('MINIO_USE_SSL') === 'true',
					accessKey,
					secretKey,
					bucket: ConfigService.get('MINIO_BUCKET') || 'r2r-images'
				});
			} else {
				storageService = new FileSystemStorageService();
			}
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
			const apiKey = ConfigService.get('OPENROUTER_API_KEY');
			if (!apiKey) {
				throw new Error('OPENROUTER_API_KEY environment variable is required');
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
			const apiKey = ConfigService.get('MISTRAL_API_KEY');
			receiptExtractor = apiKey ? new NativeReceiptExtractor(apiKey) : new MockOcrService();
		}
		return receiptExtractor;
	}

	// Deprecated alias
	static getOcrService(): IReceiptExtractor {
		return AppFactory.getReceiptExtractor();
	}

	static getCulinaryIntelligence(): ICulinaryIntelligence {
		if (!culinaryIntelligence) {
			const apiKey = ConfigService.get('OPENROUTER_API_KEY');
			if (!apiKey) {
				throw new Error('OPENROUTER_API_KEY environment variable is required');
			}
			culinaryIntelligence = new SmartCulinaryIntelligence(
				apiKey,
				ConfigService.get('OPENROUTER_MODEL') || 'google/gemini-3-flash-preview'
			);
		}
		return culinaryIntelligence;
	}

	// Deprecated alias
	static getLlmService(): ICulinaryIntelligence {
		return AppFactory.getCulinaryIntelligence();
	}

	/**
	 * The image model through OpenRouter (FLUX 3 Image Klein unless OPENROUTER_IMAGE_MODEL says
	 * otherwise). With `IMAGE_GENERATOR=seed`, or without an OpenRouter key, the committed seed
	 * photos stand in. With `IMAGE_GENERATOR=local`, FLUX runs on this machine; a production
	 * server refuses that.
	 */
	static getImageGenerator(): IImageGenerator {
		if (!imageGenerator) {
			const apiKey = ConfigService.get('OPENROUTER_API_KEY');
			const kind = chooseImageGenerator({
				setting: ConfigService.get('IMAGE_GENERATOR'),
				apiKey,
				// A built server (`dev` false) counts as production even when NODE_ENV is unset.
				production: !dev || process.env.NODE_ENV === 'production'
			});
			imageGenerator =
				kind === 'local'
					? new LocalFluxImageGenerator({
							env: {
								FLUX_LOCAL_MODEL: ConfigService.get('FLUX_LOCAL_MODEL') || DEFAULT_LOCAL_FLUX_MODEL
							}
						})
					: kind === 'openrouter' && apiKey
						? new SmartImageGenerator(
								apiKey,
								ConfigService.get('OPENROUTER_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL
							)
						: new SeedPictureGenerator(seedPictures as SeedPictureCatalog);
		}
		return imageGenerator;
	}

	static getPhotoJudge(): IPhotoJudge {
		if (!photoJudge) {
			const apiKey = ConfigService.get('OPENROUTER_API_KEY');
			if (!apiKey) {
				throw new Error('OPENROUTER_API_KEY environment variable is required');
			}
			photoJudge = new OpenRouterPhotoJudge(
				apiKey,
				ConfigService.get('OPENROUTER_VISION_MODEL') ||
					ConfigService.get('OPENROUTER_MODEL') ||
					'google/gemini-3-flash-preview'
			);
		}
		return photoJudge;
	}

	static getRecipePictureService(): IRecipePictureService {
		if (!recipePictureService) {
			recipePictureService = new RecipePictureService(
				AppFactory.getRecipeRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getImageGenerator(),
				// The judge needs an OpenRouter key; build it when a photo is judged, so picture runs
				// without a key (seed photos, local FLUX) can start.
				{ score: (photo, dish) => AppFactory.getPhotoJudge().score(photo, dish) },
				AppFactory.getStorageService(),
				AppFactory.getJobQueue(),
				AppFactory.getCookbookRecipeRepository()
			);
		}
		return recipePictureService;
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
			const concurrency = parseInt(ConfigService.get('JOB_CONCURRENCY') || '2');
			jobQueue = new JobQueue(Number.isFinite(concurrency) ? concurrency : 2);
		}
		return jobQueue;
	}

	// Domain Services - Auth now uses OAuth2/Auth0
	static getOAuthService(): IOAuthService {
		if (!oauthService) {
			const domain = ConfigService.get('OAUTH_DOMAIN');
			const clientId = ConfigService.get('OAUTH_CLIENT_ID');
			const clientSecret = ConfigService.get('OAUTH_CLIENT_SECRET');

			if (!domain || !clientId || !clientSecret) {
				throw new Error(
					'OAuth environment variables (OAUTH_DOMAIN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET) are required'
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
					callbackUrl: ConfigService.get('OAUTH_CALLBACK_URL') || '/callback',
					slug: ConfigService.get('OAUTH_APP_SLUG')
				}
			);
		}
		return oauthService!;
	}

	// Backwards compatibility - AuthService is now OAuth-based
	static getAuthService(): IOAuthService {
		return AppFactory.getOAuthService();
	}

	static getHouseholdEventService(): IHouseholdEventService {
		if (!householdEventService) {
			householdEventService = new HouseholdEventService(AppFactory.getHouseholdEventRepository());
		}
		return householdEventService;
	}

	static getNeedsYouService(): INeedsYouService {
		if (!needsYouService) {
			needsYouService = new NeedsYouService(AppFactory.getNeedsYouAnswerRepository());
		}
		return needsYouService;
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
				AppFactory.getUserPreferencesRepository(),
				AppFactory.getHouseholdRepository()
			);
		}
		return tasteProfileService;
	}

	static getNutritionService(): INutritionService {
		if (!nutritionService) {
			nutritionService = new NutritionService(
				AppFactory.getMealLogRepository(),
				AppFactory.getPlannedMealRepository(),
				AppFactory.getUserPreferencesRepository()
			);
		}
		return nutritionService;
	}

	static getHouseholdService(): IHouseholdService {
		if (!householdService) {
			householdService = new HouseholdService(AppFactory.getHouseholdRepository());
		}
		return householdService;
	}

	static getKitchenService(): IKitchenService {
		if (!kitchenService) {
			kitchenService = new KitchenService(
				AppFactory.getKitchenEventRepository(),
				AppFactory.getRecipeRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getPlannedMealRepository(),
				AppFactory.getMealLogRepository(),
				AppFactory.getHouseholdRepository()
			);
		}
		return kitchenService;
	}

	static getHabitService(): IHabitService {
		if (!habitService) {
			habitService = new HabitService(
				AppFactory.getKitchenEventRepository(),
				AppFactory.getHabitAnswerRepository(),
				AppFactory.getPlannedMealRepository(),
				AppFactory.getPurchaseHistoryRepository(),
				AppFactory.getHouseholdRepository()
			);
		}
		return habitService;
	}

	static getPlanService(): IPlanService {
		if (!planService) {
			planService = new PlanService(
				AppFactory.getPlannedMealRepository(),
				AppFactory.getRecipeRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getSavedRecipeRepository(),
				AppFactory.getKitchenEventRepository(),
				AppFactory.getHouseholdRepository(),
				AppFactory.getTasteProfileService(),
				{
					makeRecipe: async (actor, customIngredients, cuisineHint) => {
						await AppFactory.getRecipeController().generateRecipe({
							actor,
							customIngredients,
							cuisineHint,
							servings: 2,
							useRag: true
						});
					}
				},
				AppFactory.getCookbookService()
			);
		}
		return planService;
	}

	static getPlanController(): PlanController {
		if (!planController) {
			planController = new PlanController(
				AppFactory.getPlanService(),
				AppFactory.getKitchenService(),
				AppFactory.getHabitService(),
				AppFactory.getNutritionService(),
				AppFactory.getHouseholdEventService()
			);
		}
		return planController;
	}

	static getShopService(): IShopService {
		if (!shopService) {
			shopService = new ShopService(
				AppFactory.getShoppingListRepository(),
				AppFactory.getShoppingListItemRepository(),
				AppFactory.getPurchaseHistoryRepository()
			);
		}
		return shopService;
	}

	static getRecipeBookService(): IRecipeBookService {
		if (!recipeBookService) {
			recipeBookService = new RecipeBookService(
				AppFactory.getRecipeRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getRecipeStepRepository(),
				AppFactory.getJobQueue(),
				AppFactory.getCulinaryIntelligence()
			);
		}
		return recipeBookService;
	}

	// Controllers
	static getRecipeController(): RecipeController {
		if (!recipeController) {
			recipeController = new RecipeController(
				AppFactory.getCulinaryIntelligence(),
				AppFactory.getVectorService(),
				AppFactory.getTasteProfileService(),
				AppFactory.getRecipeRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getSavedRecipeRepository(),
				AppFactory.getUserPreferencesRepository(),
				AppFactory.getReceiptItemRepository(),
				AppFactory.getRecipeBookService(),
				AppFactory.getRecipePictureService(),
				AppFactory.getCookbookService()
			);
		}
		return recipeController;
	}

	static getRecipesDoorController(): RecipesDoorController {
		if (!recipesDoorController) {
			recipesDoorController = new RecipesDoorController(
				AppFactory.getCulinaryIntelligence(),
				AppFactory.getStorageService(),
				AppFactory.getKitchenService(),
				AppFactory.getTasteProfileService(),
				AppFactory.getRecipeBookService(),
				AppFactory.getUserPreferencesRepository(),
				AppFactory.getRecipeRepository(),
				AppFactory.getSavedRecipeRepository(),
				AppFactory.getMealLogRepository(),
				AppFactory.getRecipePictureService(),
				AppFactory.getCookbookService()
			);
		}
		return recipesDoorController;
	}

	static getPreferencesController(): PreferencesController {
		if (!preferencesController) {
			preferencesController = new PreferencesController(AppFactory.getUserPreferencesRepository());
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
				AppFactory.getReceiptRepository(),
				AppFactory.getReceiptItemRepository(),
				AppFactory.getPurchaseHistoryRepository(),
				AppFactory.getKitchenService(),
				AppFactory.getJobQueue()
			);
		}
		return receiptController;
	}

	static getUseItUpController(): UseItUpController {
		if (!useItUpController) {
			useItUpController = new UseItUpController(
				AppFactory.getKitchenService(),
				AppFactory.getPlanService()
			);
		}
		return useItUpController;
	}

	static getNeedsYouController(): NeedsYouController {
		if (!needsYouController) {
			needsYouController = new NeedsYouController(
				AppFactory.getKitchenService(),
				AppFactory.getHabitService(),
				AppFactory.getPlanService(),
				AppFactory.getHouseholdService(),
				AppFactory.getHouseholdEventService(),
				AppFactory.getNeedsYouService(),
				AppFactory.getShopService(),
				AppFactory.getShopController()
			);
		}
		return needsYouController;
	}

	static getShoppingListController(): ShoppingListController {
		if (!shoppingListController) {
			shoppingListController = new ShoppingListController(
				AppFactory.getShoppingListRepository(),
				AppFactory.getShoppingListItemRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getReceiptItemRepository(),
				AppFactory.getRecipeRepository(),
				AppFactory.getReceiptRepository()
			);
		}
		return shoppingListController;
	}

	static getHouseholdController(): HouseholdController {
		if (!householdController) {
			householdController = new HouseholdController(
				AppFactory.getHouseholdService(),
				AppFactory.getHouseholdEventService()
			);
		}
		return householdController;
	}

	static getKitchenController(): KitchenController {
		if (!kitchenController) {
			kitchenController = new KitchenController(
				AppFactory.getKitchenService(),
				AppFactory.getHabitService()
			);
		}
		return kitchenController;
	}

	static getTonightController(): TonightController {
		if (!tonightController) {
			tonightController = new TonightController(
				AppFactory.getPlanService(),
				AppFactory.getKitchenService(),
				AppFactory.getHabitService(),
				AppFactory.getNutritionService(),
				AppFactory.getHouseholdService(),
				AppFactory.getHouseholdEventService()
			);
		}
		return tonightController;
	}

	static getFrontDoorController(): FrontDoorController {
		if (!frontDoorController) {
			frontDoorController = new FrontDoorController(
				AppFactory.getPlanService(),
				AppFactory.getKitchenService(),
				AppFactory.getHabitService(),
				AppFactory.getHouseholdService()
			);
		}
		return frontDoorController;
	}

	static getShopController(): ShopController {
		if (!shopController) {
			shopController = new ShopController(
				AppFactory.getShopService(),
				AppFactory.getPlanService(),
				AppFactory.getKitchenService(),
				AppFactory.getHabitService(),
				AppFactory.getReceiptController(),
				AppFactory.getHouseholdEventService()
			);
		}
		return shopController;
	}

	/**
	 * Basil's models and the model it asks for: `BASIL_MODEL`, else the app's `OPENROUTER_MODEL`,
	 * on OpenRouter. In development only, `BASIL_MODEL=scripted` uses a scripted stand-in that
	 * needs no provider key.
	 */
	static getAgentModels(): { provider: ModelProvider; model: string } {
		if (!agentModels) {
			const named = ConfigService.get('BASIL_MODEL');
			if (named === 'scripted' && dev) {
				agentModels = { provider: new DevScriptedModelProvider(), model: 'scripted' };
				return agentModels;
			}
			const apiKey = ConfigService.get('OPENROUTER_API_KEY');
			if (!apiKey) {
				throw new Error('OPENROUTER_API_KEY environment variable is required');
			}
			agentModels = {
				provider: openRouterModelProvider(apiKey, { appURL: ConfigService.get('ORIGIN') }),
				model: named || ConfigService.get('OPENROUTER_MODEL') || 'google/gemini-3-flash-preview'
			};
		}
		return agentModels;
	}

	/** One per process: the bus and the running runs live in this process (adapter-node). */
	static getAgentRunService(): IAgentRunService {
		if (!agentRunService) {
			agentRunService = new AgentRunService(
				new AgentRunRepository(getDb()),
				new InProcessRunEventBus(),
				new ActiveRuns()
			);
		}
		return agentRunService;
	}

	static getAgentService(): IAgentService {
		if (!agentService) {
			const db = getDb();
			const { provider, model } = AppFactory.getAgentModels();
			agentService = new AgentService(
				new AgentConversationRepository(db),
				new AgentMessageRepository(db),
				new AgentSessionRepository(db),
				new AgentActionRepository(db),
				provider,
				model
			);
		}
		return agentService;
	}

	static getBasilController(): BasilController {
		if (!basilController) {
			basilController = new BasilController(
				AppFactory.getAgentService(),
				AppFactory.getAgentRunService(),
				(actor, now, timeZone) =>
					agentToolbox(
						{
							kitchen: () => AppFactory.getKitchenController(),
							needsYou: () => AppFactory.getNeedsYouController(),
							plan: () => AppFactory.getPlanController(),
							recipe: () => AppFactory.getRecipeController(),
							recipesDoor: () => AppFactory.getRecipesDoorController(),
							shop: () => AppFactory.getShopController(),
							tonight: () => AppFactory.getTonightController(),
							useItUp: () => AppFactory.getUseItUpController()
						},
						{ actor, now, timeZone }
					)
			);
		}
		return basilController;
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

	static getCupboardItemRepository(): ICupboardItemRepository {
		if (!cupboardItemRepository) {
			cupboardItemRepository = new CupboardItemRepository(getDb());
		}
		return cupboardItemRepository;
	}

	static getMealLogRepository(): IMealLogRepository {
		if (!mealLogRepository) {
			mealLogRepository = new MealLogRepository(getDb());
		}
		return mealLogRepository;
	}

	static getPlannedMealRepository(): IPlannedMealRepository {
		if (!plannedMealRepository) {
			plannedMealRepository = new PlannedMealRepository(getDb());
		}
		return plannedMealRepository;
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
			userIngredientPreferenceRepository = new UserIngredientPreferenceRepository(getDb());
		}
		return userIngredientPreferenceRepository;
	}

	static getUserCuisinePreferenceRepository(): IUserCuisinePreferenceRepository {
		if (!userCuisinePreferenceRepository) {
			userCuisinePreferenceRepository = new UserCuisinePreferenceRepository(getDb());
		}
		return userCuisinePreferenceRepository;
	}

	static getWaitlistRepository(): IWaitlistRepository {
		if (!waitlistRepository) {
			waitlistRepository = new WaitlistRepository(getDb());
		}
		return waitlistRepository;
	}

	static getHouseholdRepository(): IHouseholdRepository {
		if (!householdRepository) {
			householdRepository = new HouseholdRepository(getDb());
		}
		return householdRepository;
	}

	static getKitchenEventRepository(): IKitchenEventRepository {
		if (!kitchenEventRepository) {
			kitchenEventRepository = new KitchenEventRepository(getDb());
		}
		return kitchenEventRepository;
	}

	static getHabitAnswerRepository(): IHabitAnswerRepository {
		if (!habitAnswerRepository) {
			habitAnswerRepository = new HabitAnswerRepository(getDb());
		}
		return habitAnswerRepository;
	}

	static getCookbookRecipeRepository(): ICookbookRecipeRepository {
		if (!cookbookRecipeRepository) {
			cookbookRecipeRepository = new CookbookRecipeRepository(getDb());
		}
		return cookbookRecipeRepository;
	}

	static getCookbookService(): ICookbookService {
		if (!cookbookService) {
			cookbookService = new CookbookService(
				AppFactory.getCookbookRecipeRepository(),
				AppFactory.getRecipeRepository(),
				AppFactory.getRecipeIngredientRepository(),
				AppFactory.getRecipeStepRepository()
			);
		}
		return cookbookService;
	}

	static getRecipeStepRepository(): IRecipeStepRepository {
		if (!recipeStepRepository) {
			recipeStepRepository = new RecipeStepRepository(getDb());
		}
		return recipeStepRepository;
	}

	static getHouseholdEventRepository(): IHouseholdEventRepository {
		if (!householdEventRepository) {
			householdEventRepository = new HouseholdEventRepository(getDb());
		}
		return householdEventRepository;
	}

	static getNeedsYouAnswerRepository(): INeedsYouAnswerRepository {
		if (!needsYouAnswerRepository) {
			needsYouAnswerRepository = new NeedsYouAnswerRepository(getDb());
		}
		return needsYouAnswerRepository;
	}

	static getNotificationService(): INotificationService {
		if (!notificationService) {
			const endpoint = ConfigService.get('NOTIFICATION_ENDPOINT');
			if (endpoint) {
				notificationService = new AppriseNotificationService();
			} else {
				notificationService = new MockNotificationService();
			}
		}
		return notificationService;
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
		photoJudge = null;
		recipePictureService = null;
		vectorService = null;
		jobQueue = null;

		// Domain Services
		oauthService = null;
		householdEventService = null;
		needsYouService = null;
		tasteProfileService = null;
		nutritionService = null;
		householdService = null;
		kitchenService = null;
		habitService = null;
		planService = null;
		shopService = null;
		recipeBookService = null;
		agentService = null;
		agentModels = null;

		// Controllers
		recipeController = null;
		preferencesController = null;
		receiptController = null;
		useItUpController = null;
		needsYouController = null;
		shoppingListController = null;
		householdController = null;
		kitchenController = null;
		tonightController = null;
		frontDoorController = null;
		shopController = null;
		recipesDoorController = null;
		basilController = null;

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
		cupboardItemRepository = null;
		mealLogRepository = null;
		plannedMealRepository = null;
		userDietaryProfileRepository = null;
		userAllergyRepository = null;
		userIngredientPreferenceRepository = null;
		userCuisinePreferenceRepository = null;
		waitlistRepository = null;
		householdRepository = null;
		kitchenEventRepository = null;
		habitAnswerRepository = null;
		recipeStepRepository = null;
		householdEventRepository = null;
		needsYouAnswerRepository = null;
		notificationService = null;
	}
}
