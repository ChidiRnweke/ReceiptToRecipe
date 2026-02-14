export type { IStorageService, UploadResult } from './IStorageService';
export * from './IReceiptExtractor';
export type {
	ICulinaryIntelligence,
	RecipeContext,
	GeneratedRecipe as LlmGeneratedRecipe,
	ChatMessage
} from './ICulinaryIntelligence';
export * from './IImageGenerator';
export * from './IVectorService';
export * from './INormalizationService';
export type { IProductNormalizer, NormalizedProductInfo } from './IProductNormalizer';
export * from './IShoppingListService';
export type {
	IRecipeService,
	Recipe,
	RecipeWithIngredients,
	RecipeIngredient,
	GenerateRecipeInput,
	GeneratedRecipe,
	UserPreferences,
	TasteProfile
} from './IRecipeService';
export * from './IReceiptService';
export * from './IPreferencesService';
export * from './ITasteProfileService';
export * from './IPantryService';
export type {
	IDashboardService,
	DashboardData,
	DashboardMetrics,
	ActiveList,
	ActiveListStats,
	SmartSuggestion
} from './IDashboardService';

// Job Queue interface
export type { IJobQueue } from './IJobQueue';

// Auth interfaces (defined in AuthService.ts for now)
export type { IAuthService, AuthResult } from '../AuthService';

// OAuth interfaces
export type { IOAuthService, Auth0Tokens, Auth0UserInfo, PKCEChallenge } from './IOAuthService';
