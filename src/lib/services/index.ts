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
	AllergyRiskReview,
	AllergyRiskReviewInput,
	AllergyRiskLevel,
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
	IAuthService,
	AuthResult,
	INutritionService,
	CaloriesToday,
	NutritionDaySummary,
	NutritionWeekSummary,
	NutritionStreak,
	NutritionAdherence,
	NutritionAggregates,
	NutritionAggregateOptions,
	IHouseholdService,
	HouseholdUser,
	InvitePreview,
	InviteStatus,
	IKitchenService,
	KitchenAuthor,
	KitchenPicture,
	BoughtItem,
	RecordCookedInput,
	CorrectionKind,
	CorrectionInput,
	RecordShopDoneInput,
	WithdrawCupboardItemInput,
	IHabitService,
	IPlanService,
	Cookbook,
	PlannedMealWithRecipe,
	MoveOptions,
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
export { NutritionService } from './NutritionService';
export { GlobalSearchService } from './GlobalSearchService';
export { HouseholdService } from './HouseholdService';
export { KitchenService } from './KitchenService';
export { HabitService } from './HabitService';
export { PlanService } from './PlanService';
export {
	AppriseNotificationService,
	MockNotificationService,
	type INotificationService
} from './NotificationService';
