import type { ReceiptMatch } from '$lib/models/shop';
import { containsItem, sameItem } from '../tonight/items';

/** A receipt line and a list item name the same thing: "baby spinach" bought "spinach". */
export function namesSameItem(lineKey: string, itemKey: string): boolean {
	return (
		sameItem(lineKey, itemKey) || containsItem(lineKey, itemKey) || containsItem(itemKey, lineKey)
	);
}

/**
 * Matches receipt lines to list items by item key. Each line buys at most one list item and each
 * item is bought by at most one line; an exact key match wins over a partial one. Lines left over
 * are extras, items left over are missing.
 */
export function matchReceiptToList<R extends { itemKey: string }, L extends { itemKey: string }>(
	lines: R[],
	items: L[]
): ReceiptMatch<R, L> {
	const open = new Set(items.map((_, i) => i));
	const matched: { line: R; item: L }[] = [];
	const extras: R[] = [];
	const lineOrder = lines.map((line, i) => ({ line, i }));
	const pick = (line: R, test: (a: string, b: string) => boolean): number | undefined =>
		[...open].find((i) => test(line.itemKey, items[i].itemKey));

	const pending: R[] = [];
	for (const { line } of lineOrder) {
		const exact = pick(line, sameItem);
		if (exact === undefined) {
			pending.push(line);
			continue;
		}
		open.delete(exact);
		matched.push({ line, item: items[exact] });
	}
	for (const line of pending) {
		const partial = pick(line, namesSameItem);
		if (partial === undefined) {
			extras.push(line);
			continue;
		}
		open.delete(partial);
		matched.push({ line, item: items[partial] });
	}
	return { matched, extras, missing: [...open].sort((a, b) => a - b).map((i) => items[i]) };
}
