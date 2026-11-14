import {
	LEFTOVER_KEEP_DAYS,
	LEFTOVER_PREFIX,
	PERISHABLE_MAX_DAYS,
	SCRAP_SHARE,
	leftoverKey,
	type KitchenEvent,
	type KitchenEventKind,
	type Lot,
	type StockItem
} from '$lib/models/kitchen';
import { getShelfLifePure } from '../pantryCalculations';
import { dayNumber } from './days';
import { canonicalItemKey } from './itemKey';
import { convertUnit } from './units';

const EPSILON = 1e-6;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Events that happen at the same moment apply in this order: corrections come last. */
const KIND_ORDER: Record<KitchenEventKind, number> = {
	BOUGHT: 0,
	SHOP_DONE: 0,
	COOKED: 1,
	CORRECTED_GONE: 2,
	CORRECTED_STILL_GOOD: 2,
	CORRECTED_QUANTITY: 2
};

/** Shelf life in days of a bought item, from its category, or from its name when that is vague. */
export function shelfLifeDays(itemKey: string, category: string | null | undefined): number {
	const useful = category && category.toLowerCase() !== 'other' ? category : null;
	return getShelfLifePure(useful ?? itemKey);
}

/** The last local day a BOUGHT event's lot is good. */
export function boughtExpiresOn(event: KitchenEvent, timeZone: string): number {
	if (event.expiresAt) return dayNumber(event.expiresAt, timeZone);
	return (
		dayNumber(event.occurredAt, timeZone) +
		shelfLifeDays(event.itemKey ?? '', event.payload?.category)
	);
}

function isLeftover(itemKey: string): boolean {
	return itemKey.startsWith(LEFTOVER_PREFIX);
}

/**
 * Draws `quantity` of an item from the fresh lots, soonest expiry first, and returns what could
 * not be found, in the requested unit. A lot in a unit the request cannot convert to covers the
 * rest of the need without being drawn down: the item is there, the amount used is unknown.
 * With `mark`, every lot drawn on becomes an estimate, and a perishable lot left below 15% of
 * its original quantity is finished.
 */
export function consume(
	lots: Lot[],
	itemKey: string,
	quantity: number,
	unit: string,
	day: number,
	mark: boolean
): number {
	const key = canonicalItemKey(itemKey);
	let remaining = quantity;
	const fresh = lots
		.filter((lot) => lot.itemKey === key && lot.quantity > EPSILON && lot.expiresOn >= day)
		.sort((a, b) => a.expiresOn - b.expiresOn);

	for (const lot of fresh) {
		if (remaining <= EPSILON) break;
		const wanted = convertUnit(remaining, unit, lot.unit);
		if (mark && !isLeftover(key)) lot.known = false;
		if (wanted === null) {
			remaining = 0;
			break;
		}
		const taken = Math.min(lot.quantity, wanted);
		lot.quantity -= taken;
		remaining = convertUnit(wanted - taken, lot.unit, unit) ?? 0;
		if (mark && lot.perishable && lot.quantity < lot.initialQuantity * SCRAP_SHARE) {
			lot.quantity = 0;
		}
	}
	return remaining > EPSILON ? remaining : 0;
}

function leftoverLot(sourceId: string, portions: number, day: number): Lot {
	return {
		itemKey: leftoverKey(sourceId),
		quantity: portions,
		initialQuantity: portions,
		unit: 'portion',
		expiresOn: day + LEFTOVER_KEEP_DAYS,
		known: true,
		perishable: false,
		source: 'leftover'
	};
}

/** Adds the leftover lot a meal puts aside. Shared with the forecast. */
export function putAside(lots: Lot[], sourceId: string, portions: number, day: number): void {
	if (portions > 0) lots.push(leftoverLot(sourceId, portions, day));
}

function applyEvent(lots: Lot[], event: KitchenEvent, timeZone: string): void {
	const day = dayNumber(event.occurredAt, timeZone);
	// Keys are matched in their current normal form, so events stored under an older form
	// ("eggs", "Baby  Spinach") merge with new ones.
	const itemKey = event.itemKey ? canonicalItemKey(event.itemKey) : null;

	switch (event.kind) {
		case 'BOUGHT': {
			if (!itemKey) return;
			const quantity = event.quantity ?? 1;
			const expiresOn = boughtExpiresOn(event, timeZone);
			lots.push({
				itemKey,
				quantity,
				initialQuantity: quantity,
				unit: event.unit ?? 'count',
				expiresOn,
				known: event.known,
				perishable: expiresOn - day <= PERISHABLE_MAX_DAYS,
				source: 'bought'
			});
			return;
		}
		case 'COOKED': {
			for (const used of event.payload?.ingredients ?? []) {
				const usedKey = canonicalItemKey(used.itemKey);
				const before = lots.filter((lot) => lot.itemKey === usedKey);
				consume(lots, usedKey, used.quantity, used.unit, day, true);
				if (used.estimate) before.forEach((lot) => (lot.known = false));
			}
			putAside(lots, event.plannedMealId ?? event.id, event.portions ?? 0, day);
			return;
		}
		case 'CORRECTED_GONE': {
			for (const lot of lots) if (lot.itemKey === itemKey) lot.quantity = 0;
			return;
		}
		case 'CORRECTED_STILL_GOOD': {
			for (const lot of lots) {
				if (lot.itemKey !== itemKey || lot.quantity <= EPSILON) continue;
				lot.known = true;
				lot.expiresOn = Math.max(lot.expiresOn, day + 1);
			}
			return;
		}
		case 'CORRECTED_QUANTITY': {
			if (!itemKey) return;
			const existing = lots.filter((lot) => lot.itemKey === itemKey);
			const fresh = existing.filter((lot) => lot.quantity > EPSILON && lot.expiresOn >= day);
			existing.forEach((lot) => (lot.quantity = 0));
			const quantity = event.quantity ?? 0;
			if (quantity <= EPSILON) return;
			const shelf = shelfLifeDays(itemKey, event.payload?.category);
			const expiresOn = fresh.length ? Math.max(...fresh.map((lot) => lot.expiresOn)) : day + shelf;
			lots.push({
				itemKey,
				quantity,
				initialQuantity: quantity,
				unit: event.unit ?? existing[0]?.unit ?? 'count',
				expiresOn,
				known: true,
				perishable: shelf <= PERISHABLE_MAX_DAYS,
				source: 'corrected'
			});
			return;
		}
		case 'SHOP_DONE':
			return;
	}
}

function chronological(events: KitchenEvent[]): KitchenEvent[] {
	return [...events].sort(
		(a, b) =>
			a.occurredAt.getTime() - b.occurredAt.getTime() || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
	);
}

/** Replays the events up to `at` and returns the lots they leave in the kitchen. */
export function projectKitchen(events: KitchenEvent[], at: Date, timeZone: string): Lot[] {
	const lots: Lot[] = [];
	for (const event of chronological(events)) {
		if (event.occurredAt.getTime() > at.getTime()) break;
		applyEvent(lots, event, timeZone);
	}
	return lots.filter((lot) => lot.quantity > EPSILON);
}

/** Sums the lots per item as they stand on `day`. */
export function stockAt(lots: Lot[], day: number): StockItem[] {
	const byItem = new Map<string, Lot[]>();
	for (const lot of lots) {
		if (lot.quantity <= EPSILON) continue;
		const key = canonicalItemKey(lot.itemKey);
		const group = byItem.get(key) ?? [];
		group.push(lot);
		byItem.set(key, group);
	}

	return [...byItem.entries()].map(([itemKey, group]) => {
		const unit = group[0].unit;
		const fresh = group.filter((lot) => lot.expiresOn >= day);
		const quantity = fresh.reduce(
			(sum, lot) => sum + (convertUnit(lot.quantity, lot.unit, unit) ?? lot.quantity),
			0
		);
		const item: StockItem = {
			itemKey,
			quantity,
			unit,
			expiresOn: fresh.length
				? Math.min(...fresh.map((lot) => lot.expiresOn))
				: Math.max(...group.map((lot) => lot.expiresOn)),
			known: group.every((lot) => lot.known),
			off: fresh.length === 0
		};
		if (isLeftover(itemKey)) item.leftoverOf = itemKey.slice(LEFTOVER_PREFIX.length);
		return item;
	});
}

/**
 * The events that shape today's kitchen: everything from the last `windowDays` days, plus the
 * older history of any item whose older purchase is still good today (rice, tins, frozen food).
 */
export function pictureEvents(
	events: KitchenEvent[],
	now: Date,
	timeZone: string,
	windowDays = 90
): KitchenEvent[] {
	const windowStart = now.getTime() - windowDays * DAY_MS;
	const today = dayNumber(now, timeZone);
	const longLived = new Set<string>();
	for (const event of events) {
		if (event.occurredAt.getTime() >= windowStart) continue;
		if (event.kind === 'BOUGHT' && event.itemKey && boughtExpiresOn(event, timeZone) >= today) {
			longLived.add(canonicalItemKey(event.itemKey));
		}
	}
	return events.filter(
		(event) =>
			event.occurredAt.getTime() >= windowStart ||
			(event.itemKey !== null && longLived.has(canonicalItemKey(event.itemKey)))
	);
}
