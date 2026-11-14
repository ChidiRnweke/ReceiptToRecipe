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
	ICupboardItemRepository,
	ReceiptDao,
	RecipeWithIngredientsDao
} from '$repositories';
import type { ShoppingListController } from '$controllers';
import type { IPantryService, PantryItem } from './interfaces/IPantryService';
import type { IKitchenService } from './interfaces/IKitchenService';
import { PantryController } from '$controllers';
import { calculateListStatsPure } from './dashboardCalculations';
import type { Actor } from '$lib/models/household';

export class DashboardService implements IDashboardService {
	constructor(
		private receiptRepo: IReceiptRepository,
		private recipeRepo: IRecipeRepository,
		private savedRecipeRepo: ISavedRecipeRepository,
		private shoppingListRepo: IShoppingListRepository,
		private pantryService: IPantryService,
		private purchaseHistoryRepo: IPurchaseHistoryRepository,
		private receiptItemRepo: IReceiptItemRepository,
		private shoppingListController: ShoppingListController,
		private cupboardItemRepo: ICupboardItemRepository,
		private kitchenService: IKitchenService
	) {}

	async getDashboardData(actor: Actor): Promise<DashboardData> {
		const { householdId } = actor;
		// Fetch all counts and active list in parallel. Saved recipes are per person.
		const [receiptCount, recipeCount, savedCount, activeList] = await Promise.all([
			this.receiptRepo.countByHouseholdId(householdId),
			this.recipeRepo.countByHouseholdId(householdId),
			this.savedRecipeRepo.countByUserId(actor.userId),
			this.shoppingListRepo.findActiveByHouseholdId(householdId)
		]);

		// Fetch recent receipts (3)
		const recentReceipts: ReceiptDao[] = await this.receiptRepo.findByHouseholdId(householdId, 3);

		// Fetch recent recipes with ingredients (6)
		const recentRecipes: RecipeWithIngredientsDao[] =
			await this.recipeRepo.findByHouseholdIdWithIngredients(householdId, 6);

		// Fetch smart suggestions (5)
		const suggestions: SmartSuggestion[] = await this.shoppingListController.getSmartSuggestions(
			actor,
			5
		);

		// Fetch pantry items
		const pantryController = new PantryController(
			this.pantryService,
			this.purchaseHistoryRepo,
			this.receiptItemRepo,
			this.cupboardItemRepo,
			this.kitchenService
		);
		const pantry: PantryItem[] = await pantryController.getHouseholdPantry(actor);

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
