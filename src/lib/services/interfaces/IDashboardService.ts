import type { ReceiptDao, RecipeWithIngredientsDao, ShoppingListWithItemsDao } from '$repositories';
import type { PantryItem } from './IPantryService';

export interface SmartSuggestion {
	itemName: string;
	lastPurchased: Date;
	avgFrequencyDays: number | null;
	daysSinceLastPurchase: number;
	suggestedQuantity: string | null;
}

export interface DashboardMetrics {
	receipts: number;
	recipes: number;
	saved: number;
	activeListItems: number;
}

export interface ActiveListStats {
	totalItems: number;
	checkedItems: number;
	completionPercent: number;
}

export interface ActiveList {
	id: string;
	name: string;
	items: ShoppingListWithItemsDao['items'];
	stats: ActiveListStats | null;
}

export interface DashboardData {
	metrics: DashboardMetrics;
	recentReceipts: ReceiptDao[];
	recentRecipes: RecipeWithIngredientsDao[];
	suggestions: SmartSuggestion[];
	pantry: PantryItem[];
	activeList: ActiveList | null;
}

export interface IDashboardService {
	getDashboardData(userId: string): Promise<DashboardData>;
}
