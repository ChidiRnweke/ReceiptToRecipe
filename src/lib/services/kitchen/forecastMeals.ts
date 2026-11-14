import type { Lot, MealForecast, MealNeed, Quantity } from '$lib/models/kitchen';
import { consume, putAside } from './projectKitchen';

/**
 * Walks the meals from `from` to `to` (local days, inclusive) in order against a copy of the
 * lots, and reports per meal what the kitchen will not have by then. An earlier meal uses up
 * stock before a later one sees it, and a meal that puts portions aside leaves a leftover lot
 * for the meals after it. Expired lots never count.
 */
export function forecastMeals(
	lots: Lot[],
	meals: MealNeed[],
	from: number,
	to: number
): MealForecast[] {
	const simulated = lots.map((lot) => ({ ...lot }));
	const upcoming = meals
		.filter((meal) => meal.day >= from && meal.day <= to)
		.map((meal, index) => ({ meal, index }))
		.sort((a, b) => a.meal.day - b.meal.day || a.index - b.index)
		.map(({ meal }) => meal);

	return upcoming.map((meal) => {
		const missing: Quantity[] = [];
		for (const need of meal.ingredients) {
			const short = consume(simulated, need.itemKey, need.quantity, need.unit, meal.day, false);
			if (short > 0) missing.push({ itemKey: need.itemKey, quantity: short, unit: need.unit });
		}
		putAside(simulated, meal.id, meal.portions ?? 0, meal.day);
		return { meal, missing };
	});
}
