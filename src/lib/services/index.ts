// Export all interfaces first (type-only)
export type {
	IStorageService,
	UploadResult,
	IReceiptExtractor,
	RawReceiptData,
	RawReceiptItem,
	ICulinaryIntelligence,
	RecipeContext,
	LlmGeneratedRecipe,
	ChatMessage,
	IImageGenerator,
	GeneratedImage,
	IVectorService,
	VectorSearchResult,
	INormalizationService,
	IProductNormalizer,
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
	ConfidenceFactors,
	StockOverrides,
	IDashboardService,
	DashboardData,
	DashboardMetrics,
	ActiveList,
	ActiveListStats,
	IAuthService,
	AuthResult,
	// OAuth interfaces
	IOAuthService,
	Auth0Tokens,
	Auth0UserInfo,
	PKCEChallenge
} from './interfaces';

// Export implementations
export { MinioStorageService, type MinioConfig } from './MinioStorageService';
export { FileSystemStorageService } from './FileSystemStorageService';
export { NormalizationService } from './NormalizationService';
export {
	AuthService,
	getSessionCookie,
	setSessionCookie,
	deleteSessionCookie
} from './AuthService';
export {
	AuthentikOAuthService,
	getPKCECookie,
	setPKCECookie,
	deletePKCECookie,
	type OAuthResult
} from './AuthentikOAuthService';
export { NativeReceiptExtractor } from './NativeReceiptExtractor';
export { MockOcrService } from './MockOcrService';
export { SmartCulinaryIntelligence } from './SmartCulinaryIntelligence';
export { SmartProductNormalizer } from './SmartProductNormalizer';
export { SmartImageGenerator } from './SmartImageGenerator';
export * from './PgVectorService';
export * from './JobQueue';
export { PantryService } from './PantryService';
export { TasteProfileService } from './TasteProfileService';
export { DashboardService } from './DashboardService';
export {
	AppriseNotificationService,
	MockNotificationService,
	type INotificationService
} from './NotificationService';
