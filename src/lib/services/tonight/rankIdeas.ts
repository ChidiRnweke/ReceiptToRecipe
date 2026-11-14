import type { PlanRecipe } from '$lib/models/plan';
import { convertUnit } from '../kitchen/units';
import { containsItem, sameItem, type RankStock } from './items';

/** Staples a household that does not track its kitchen is assumed to have. */
export const STAPLES = ['onion', 'garlic', 'pasta', 'rice', 'chopped tomatoes'];

/** A perishable counts as "use it" when it goes off within this many days. */
export const USE_WITHIN_DAYS = 2;
/** A recipe planned within this many days is pushed down the ideas. */
export const PLANNED_SOON_DAYS = 3;

const USE_WEIGHT = 3;
const MISSING_WEIGHT = 1.3;
const PLANNED_SOON_PENALTY = 6;
/** Less than this share of the amount needed counts as missing. */
const ENOUGH_SHARE = 0.85;

export interface RankOptions {
	/** Today's local day. */
	day: number;
	/** The household records purchases (has BOUGHT events). */
	tracksKitchen: boolean;
	/** For a household that does not track: item keys of recipes it cooked or saved. */
	known?: string[];
	/** Recipe ids never offered, e.g. the meal already planned. */
	exclude?: string[];
	/** Scales recipe amounts to the servings cooked. */
	factor?: number;
	limit?: number;
}

export interface RankedIdea<R extends PlanRecipe> {
	recipe: R;
	/** Ingredient keys of perishables in the kitchen that go off within two days. */
	uses: string[];
	/** Ingredient keys the kitchen does not have enough of. */
	missing: string[];
}

/**
 * Orders recipes by what they rescue and what they lack: three points per perishable in the
 * kitchen that goes off within two days, minus 1.3 per missing ingredient, minus 6 when the
 * recipe is already planned in the next three days. A household that does not track its
 * kitchen is assumed to have the staples and the ingredients of recipes it cooked or saved.
 */
export function rankIdeas<R extends PlanRecipe>(
	recipes: R[],
	stock: RankStock[],
	plannedSoon: string[],
	options: RankOptions
): RankedIdea<R>[] {
	const factor = options.factor ?? 1;
	const exclude = new Set(options.exclude ?? []);
	const soon = new Set(plannedSoon);
	const known = options.known ?? [];
	const assumed = (itemKey: string) =>
		!options.tracksKitchen &&
		(STAPLES.some((staple) => containsItem(itemKey, staple)) ||
			known.some((key) => sameItem(key, itemKey)));

	return recipes
		.filter((recipe) => !exclude.has(recipe.id))
		.map((recipe, index) => {
			const uses: string[] = [];
			const missing: string[] = [];
			for (const ingredient of recipe.ingredients) {
				const item = stock.find((x) => !x.off && sameItem(x.itemKey, ingredient.itemKey));
				if (item?.perishable && item.expiresOn - options.day <= USE_WITHIN_DAYS) {
					uses.push(ingredient.itemKey);
				}
				if (item) {
					const needed = convertUnit(ingredient.quantity * factor, ingredient.unit, item.unit);
					if (needed !== null && item.quantity < needed * ENOUGH_SHARE) {
						missing.push(ingredient.itemKey);
					}
				} else if (!assumed(ingredient.itemKey)) {
					missing.push(ingredient.itemKey);
				}
			}
			const score =
				uses.length * USE_WEIGHT -
				missing.length * MISSING_WEIGHT -
				(soon.has(recipe.id) ? PLANNED_SOON_PENALTY : 0);
			return { recipe, uses, missing, score, index };
		})
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.slice(0, options.limit ?? 3)
		.map(({ recipe, uses, missing }) => ({ recipe, uses, missing }));
}
