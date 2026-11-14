/** Things most kitchens hold, so a recipe never asks you to buy them. */
const STAPLES = new Set([
	'salt',
	'pepper',
	'black pepper',
	'salt and pepper',
	'water',
	'oil',
	'olive oil',
	'vegetable oil',
	'cooking oil'
]);

function key(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Splits a recipe's ingredients into the ones the kitchen holds and the ones to buy. An ingredient
 * matches a stock item when either name contains the other ("spinach" and "baby spinach").
 * Optional ingredients and staples are never listed as needed.
 */
export function matchKitchen(
	ingredients: ReadonlyArray<{ name: string; optional: boolean }>,
	stockKeys: readonly string[]
): { uses: string[]; need: string[] } {
	const stock = stockKeys.map(key).filter((item) => item.length > 0);
	const uses: string[] = [];
	const need: string[] = [];
	for (const ingredient of ingredients) {
		const name = key(ingredient.name);
		if (stock.some((item) => item.includes(name) || name.includes(item))) uses.push(name);
		else if (!ingredient.optional && !STAPLES.has(name)) need.push(name);
	}
	return { uses, need };
}
