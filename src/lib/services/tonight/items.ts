import type { Lot, StockItem } from '$lib/models/kitchen';

/** A stock item with whether any of its good lots is perishable. */
export interface RankStock extends StockItem {
	perishable: boolean;
}

/** "tomatoes" and "tomato" name the same item; so do "red onions" and "red onion". */
export function singularKey(itemKey: string): string {
	return itemKey
		.split(' ')
		.map((word) =>
			word.length > 3 && /(oes|ches|shes)$/.test(word)
				? word.slice(0, -2)
				: word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
					? word.slice(0, -1)
					: word
		)
		.join(' ');
}

export function sameItem(a: string, b: string): boolean {
	return a === b || singularKey(a) === singularKey(b);
}

/** True when `phrase` appears as whole words in `itemKey`: "onion" is in "red onions". */
export function containsItem(itemKey: string, phrase: string): boolean {
	const words = ` ${singularKey(itemKey)} `;
	return words.includes(` ${singularKey(phrase)} `);
}

/** Stock items marked perishable when any of their lots still good on `day` is perishable. */
export function withPerishable(stock: StockItem[], lots: Lot[], day: number): RankStock[] {
	return stock.map((item) => ({
		...item,
		perishable: lots.some(
			(lot) =>
				lot.itemKey === item.itemKey && lot.perishable && lot.expiresOn >= day && lot.quantity > 0
		)
	}));
}

/** "spinach", "spinach and feta", "spinach, feta and eggs". */
export function listNames(names: string[]): string {
	if (names.length < 2) return names.join('');
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
