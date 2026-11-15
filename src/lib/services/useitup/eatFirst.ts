import { LEFTOVER_PREFIX } from '$lib/models/kitchen';
import type { HomeItem } from '$lib/models/useitup';
import type { RankStock } from '../tonight/items';
import { formatAmount } from '../tonight/copy';
import { listNames } from '../tonight/items';

/** A perishable or leftover that goes off within this many days needs eating first. */
export const EAT_FIRST_DAYS = 3;
/** The note to put new things at the front shows this many hours after a shop. */
export const JUST_SHOPPED_HOURS = 3;
/** The note names at most this many items. */
const FRONT_COUNT = 3;

/** What `eatFirst` reads of a stock item. */
export interface FreshStock {
	itemKey: string;
	off: boolean;
	expiresOn: number;
	perishable: boolean;
}

export function isLeftover(itemKey: string): boolean {
	return itemKey.startsWith(LEFTOVER_PREFIX);
}

/**
 * What needs eating first: perishables and leftovers that have gone off or expire within three
 * days. Gone-off items come first, then the soonest to expire.
 */
export function eatFirst<T extends FreshStock>(stock: T[], today: number): T[] {
	return stock
		.filter((item) => item.perishable || isLeftover(item.itemKey))
		.filter((item) => item.off || item.expiresOn - today <= EAT_FIRST_DAYS)
		.sort((a, b) => Number(b.off) - Number(a.off) || a.expiresOn - b.expiresOn);
}

/** "450 g", "6", "1 portion", "2 portions". */
export function homeAmount(quantity: number, unit: string): string {
	if (unit === 'portion') {
		const n = Math.round(quantity);
		return `${n} portion${n === 1 ? '' : 's'}`;
	}
	return formatAmount(quantity, unit);
}

export function toHomeItem(item: RankStock, today: number): HomeItem {
	return {
		itemKey: item.itemKey,
		name: item.name,
		amount: homeAmount(item.quantity, item.unit),
		quantity: item.quantity,
		unit: item.unit,
		known: item.known,
		off: item.off,
		daysLeft: item.expiresOn - today,
		perishable: item.perishable,
		leftover: isLeftover(item.itemKey)
	};
}

/**
 * The items to put at the front of the fridge after a shop: the first three that need eating
 * first and have not gone off, as "feta, yogurt and chicken thighs". Null when there are none.
 */
export function frontNames(first: { name: string; off: boolean }[]): string | null {
	const front = first.filter((item) => !item.off).slice(0, FRONT_COUNT);
	return front.length ? listNames(front.map((item) => item.name.toLowerCase())) : null;
}
