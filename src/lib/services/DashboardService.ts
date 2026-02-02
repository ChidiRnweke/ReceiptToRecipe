import type { IDashboardService, DashboardData, DashboardMetrics, ActiveList, ActiveListStats, SmartSuggestion } from './interfaces/IDashboardService';
import type { 
	IReceiptRepository, 
	IRecipeRepository, 
	ISavedRecipeRepository, 
	IShoppingListRepository,
	ReceiptDao,
	RecipeWithIngredientsDao,
	ShoppingListItemDao
} from '$repositories';
import { ShoppingListController } from '$controllers';
import type { IPantryService, PantryItem } from './interfaces/IPantryService';
import { PantryController } from '$controllers';

export class DashboardService implements IDashboardService {
	constructor(
		private receiptRepo: IReceiptRepository,
		private recipeRepo: IRecipeRepository,
		private savedRecipeRepo: ISavedRecipeRepository,
		private shoppingListRepo: IShoppingListRepository,
		private pantryService: IPantryService
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
		const recentRecipes: RecipeWithIngredientsDao[] = await this.recipeRepo.findByUserIdWithIngredients(userId, 6);

		// Fetch smart suggestions (5)
		const listController = new ShoppingListController();
		const suggestions: SmartSuggestion[] = await listController.getSmartSuggestions(userId, 5);

		// Fetch pantry items
		const pantryController = new PantryController(this.pantryService);
		const pantry: PantryItem[] = await pantryController.getUserPantry(userId);

		// Calculate metrics
		const metrics: DashboardMetrics = {
			receipts: receiptCount,
			recipes: recipeCount,
			saved: savedCount,
			activeListItems: activeList?.items?.length || 0
		};

		// Calculate active list stats
		const activeListWithStats: ActiveList | null = activeList ? {
			id: activeList.id,
			name: activeList.name,
			items: activeList.items,
			stats: this.calculateListStats(activeList.items)
		} : null;

		return {
			metrics,
			recentReceipts,
			recentRecipes,
			suggestions,
			pantry,
			activeList: activeListWithStats
		};
	}

	private calculateListStats(items: ShoppingListItemDao[]): ActiveListStats | null {
		if (!items || items.length === 0) {
			return null;
		}

		const totalItems = items.length;
		const checkedItems = items.filter((i: ShoppingListItemDao) => i.checked).length;
		const completionPercent = totalItems > 0
			? Math.round((checkedItems / totalItems) * 100)
			: 0;

		return {
			totalItems,
			checkedItems,
			completionPercent
		};
	}
}
