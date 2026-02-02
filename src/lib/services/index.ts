// Export all interfaces first (type-only)
export type {
	IStorageService,
	UploadResult,
	IOcrService,
	RawReceiptData,
	RawReceiptItem,
	ILlmService,
	RecipeContext,
	GeneratedRecipe as LlmGeneratedRecipe,
	ChatMessage,
	IImageGenService,
	GeneratedImage,
	IVectorService,
	VectorSearchResult,
	INormalizationService,
	IProductNormalizationService,
	NormalizedProductInfo,
	IShoppingListService,
	AddItemInput,
	SmartSuggestion,
	ShoppingListWithItems,
	ShoppingListItem,
	IRecipeService,
	Recipe,
	RecipeWithIngredients,
	RecipeIngredient,
	GenerateRecipeInput,
	UserPreferences,
	TasteProfile,
	IReceiptService,
	Receipt,
	ReceiptItem,
	ReceiptWithItems,
	UploadReceiptInput,
	UpdateReceiptItemInput,
	IPreferencesService,
	UpdatePreferencesInput,
	ITasteProfileService,
	CompatibilityResult,
	DietType,
	PreferenceLevel,
	AllergySeverity,
	IPantryService,
	PantryItem,
	IDashboardService,
	DashboardData,
	DashboardMetrics,
	ActiveList,
	ActiveListStats,
	IAuthService,
	AuthResult
} from "./interfaces";

// Export implementations
export { MinioStorageService, type MinioConfig } from "./MinioStorageService";
export { FileSystemStorageService } from "./FileSystemStorageService";
export { NormalizationService } from "./NormalizationService";
export {
	AuthService,
	getSessionCookie,
	setSessionCookie,
	deleteSessionCookie,
} from "./AuthService";
export { MistralOcrService } from "./MistralOcrService";
export { MockOcrService } from "./MockOcrService";
export { GeminiLlmService } from "./GeminiLlmService";
export { GeminiProductNormalizationService } from "./GeminiProductNormalizationService";
export { DalleImageService } from "./DalleImageService";
export { GeminiImageService } from "./GeminiImageService";
export * from "./PgVectorService";
export * from "./JobQueue";
export { PantryService } from "./PantryService";
export { TasteProfileService } from "./TasteProfileService";
export { DashboardService } from "./DashboardService";
