import type { IdeaIngredient, ShopLine } from '$lib/models/shop';
import { convertUnit } from '../kitchen/units';
import { sameItem } from '../tonight/items';
import { roundPack } from './needs';

/**
 * The list a few ticked dinners make: their ingredients summed per item, less what the kitchen
 * holds, rounded up to pack sizes. Items the kitchen has enough of drop out.
 */
export function ideaList(
	ideas: { recipeId: string; ingredients: IdeaIngredient[] }[],
	selected: string[]
): ShopLine[] {
	const sums: IdeaIngredient[] = [];
	for (const idea of ideas) {
		if (!selected.includes(idea.recipeId)) continue;
		for (const ingredient of idea.ingredients) {
			const into = sums.find(
				(sum) =>
					sameItem(sum.itemKey, ingredient.itemKey) &&
					convertUnit(ingredient.quantity, ingredient.unit, sum.unit) !== null
			);
			if (into) {
				into.quantity += convertUnit(ingredient.quantity, ingredient.unit, into.unit) ?? 0;
			} else {
				sums.push({ ...ingredient });
			}
		}
	}
	return sums
		.map((sum) => ({ ...sum, quantity: sum.quantity - sum.have }))
		.filter((sum) => sum.quantity > 1e-6)
		.map((sum) => ({
			itemKey: sum.itemKey,
			name: sum.name,
			quantity: roundPack(sum.quantity, sum.unit),
			unit: sum.unit
		}));
}
