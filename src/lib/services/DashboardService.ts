import type {
	IDashboardService,
	DashboardData,
	DashboardMetrics,
	ActiveList,
	SmartSuggestion
} from './interfaces/IDashboardService';
import type {
	IReceiptRepository,
	IRecipeRepository,
	ISavedRecipeRepository,
	IShoppingListRepository,
	IPurchaseHistoryRepository,
	IReceiptItemRepository,
	ReceiptDao,
	RecipeWithIngredientsDao
} from '$repositories';
import type { ShoppingListController } from '$controllers';
import type { IPantryService, PantryItem } from './interfaces/IPantryService';
import { PantryController } from '$controllers';
import { calculateListStatsPure } from './dashboardCalculations';

export class DashboardService implements IDashboardService {
	constructor(
		private receiptRepo: IReceiptRepository,
		private recipeRepo: IRecipeRepository,
		private savedRecipeRepo: ISavedRecipeRepository,
		private shoppingListRepo: IShoppingListRepository,
		private pantryService: IPantryService,
		private purchaseHistoryRepo: IPurchaseHistoryRepository,
		private receiptItemRepo: IReceiptItemRepository,
		private shoppingListController: ShoppingListController
	) {}

	async getDashboardData(userId: string): Promise<DashboardData> {
		// Fetch all counts and active list in parallel
		const [receiptCount, recipeCount, savedCount, activeList] = await Promise.all([
			this.receiptRepo.countByUserId(userId),
			this.recipeRepo.countByUserId(userId),
			this.savedRecipeRepo.countByUserId(userId),
			this.shoppingListRepo.findActiveByUserId(userId)
		]);

		// Fetch recent receipts (3)
		const recentReceipts: ReceiptDao[] = await this.receiptRepo.findByUserId(userId, 3);

		// Fetch recent recipes with ingredients (6)
		const recentRecipes: RecipeWithIngredientsDao[] =
			await this.recipeRepo.findByUserIdWithIngredients(userId, 6);

		// Fetch smart suggestions (5)
		const suggestions: SmartSuggestion[] = await this.shoppingListController.getSmartSuggestions(
			userId,
			5
		);

		// Fetch pantry items
		const pantryController = new PantryController(
			this.pantryService,
			this.purchaseHistoryRepo,
			this.receiptItemRepo
		);
		const pantry: PantryItem[] = await pantryController.getUserPantry(userId);

		// Calculate metrics
		const metrics: DashboardMetrics = {
			receipts: receiptCount,
			recipes: recipeCount,
			saved: savedCount,
			activeListItems: activeList?.items?.length || 0
		};

		// Calculate active list stats
		const activeListWithStats: ActiveList | null = activeList
			? {
					id: activeList.id,
					name: activeList.name,
					items: activeList.items,
					stats: calculateListStatsPure(activeList.items)
				}
			: null;

		return {
			metrics,
			recentReceipts,
			recentRecipes,
			suggestions,
			pantry,
			activeList: activeListWithStats
		};
	}
}
