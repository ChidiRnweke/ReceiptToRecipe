import type { Lot, ShopDay } from '../../../src/lib/models/kitchen';
import type { ShopIngredient, ShopMeal } from '../../../src/lib/models/shop';
import type { MealType } from '../../../src/lib/models/plan';
import { at, DAY0 } from '../../helpers/kitchenEvents';

/** Wednesday 4 November 2026, 18:00 UTC: the evening before Thursday's shop. */
export const WEDNESDAY_EVENING = at(2, 18);

/** The household shops on Mondays and Thursdays at 10:00. */
export const MON_THU: ShopDay[] = [
	{ weekday: 0, hour: 10 },
	{ weekday: 3, hour: 10 }
];

export function need(itemKey: string, quantity: number, unit: string): ShopIngredient {
	return { itemKey, name: itemKey, quantity, unit };
}

/** A meal `day` days after the test Monday. */
export function meal(
	id: string,
	day: number,
	ingredients: ShopIngredient[],
	mealType: MealType = 'DINNER'
): ShopMeal {
	return { id, title: id, imageUrl: null, day: DAY0 + day, mealType, ingredients };
}

/** A lot bought on the test Monday that keeps until `keepsDays` after it. */
export function lot(
	itemKey: string,
	quantity: number,
	unit: string,
	options: { initial?: number; keepsDays?: number } = {}
): Lot {
	return {
		itemKey,
		quantity,
		initialQuantity: options.initial ?? quantity,
		unit,
		expiresOn: DAY0 + (options.keepsDays ?? 30),
		known: true,
		perishable: (options.keepsDays ?? 30) <= 7,
		source: 'bought'
	};
}
