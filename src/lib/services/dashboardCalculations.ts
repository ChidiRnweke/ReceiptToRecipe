import type { ShoppingListItemDao } from '$repositories';
import type { ActiveListStats } from './interfaces/IDashboardService';

/**
 * Calculate shopping list completion stats from a list of items.
 * Pure function - no side effects or external dependencies.
 */
export function calculateListStatsPure(items: ShoppingListItemDao[]): ActiveListStats | null {
	if (!items || items.length === 0) {
		return null;
	}

	const totalItems = items.length;
	const checkedItems = items.filter((i: ShoppingListItemDao) => i.checked).length;
	const completionPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

	return {
		totalItems,
		checkedItems,
		completionPercent
	};
}
