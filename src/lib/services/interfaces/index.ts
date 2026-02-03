export type { IStorageService, UploadResult } from "./IStorageService";
export * from "./IOcrService";
export type { ILlmService, RecipeContext, GeneratedRecipe as LlmGeneratedRecipe, ChatMessage } from "./ILlmService";
export * from "./IImageGenService";
export * from "./IVectorService";
export * from "./INormalizationService";
export type { IProductNormalizationService, NormalizedProductInfo } from "./IProductNormalizationService";
export * from "./IShoppingListService";
export type { IRecipeService, Recipe, RecipeWithIngredients, RecipeIngredient, GenerateRecipeInput, GeneratedRecipe, UserPreferences, TasteProfile } from "./IRecipeService";
export * from "./IReceiptService";
export * from "./IPreferencesService";
export * from "./ITasteProfileService";
export * from "./IPantryService";
export type { IDashboardService, DashboardData, DashboardMetrics, ActiveList, ActiveListStats, SmartSuggestion } from "./IDashboardService";

// Auth interfaces (defined in AuthService.ts for now)
export type { IAuthService, AuthResult } from "../AuthService";

// OAuth interfaces
export type {
  IOAuthService,
  Auth0Tokens,
  Auth0UserInfo,
  PKCEChallenge,
} from "./IOAuthService";
