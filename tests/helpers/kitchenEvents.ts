import type { KitchenEvent, UsedIngredient } from '../../src/lib/models/kitchen';
import { dayNumber } from '../../src/lib/services/kitchen';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 2 November 2026, 00:00 UTC: day 0 of the test calendar. */
export const MONDAY = new Date('2026-11-02T00:00:00Z');
export const TZ = 'UTC';
/** The day number of the test calendar's day 0. */
export const DAY0 = dayNumber(MONDAY, TZ);

/** A moment `days` after the test Monday at `hour` UTC. */
export function at(days: number, hour = 12): Date {
	return new Date(MONDAY.getTime() + days * DAY_MS + hour * 60 * 60 * 1000);
}

let sequence = 0;

function event(overrides: Partial<KitchenEvent> & Pick<KitchenEvent, 'kind'>): KitchenEvent {
	sequence += 1;
	return {
		id: `event-${sequence}`,
		householdId: 'household-1',
		actorUserId: 'user-1',
		occurredAt: at(0),
		itemKey: null,
		quantity: null,
		unit: null,
		expiresAt: null,
		known: true,
		portions: null,
		receiptItemId: null,
		plannedMealId: null,
		recipeId: null,
		method: null,
		payload: null,
		createdAt: at(0),
		...overrides
	};
}

export function bought(
	itemKey: string,
	quantity: number,
	unit: string,
	day: number,
	options: { category?: string; expiresInDays?: number } = {}
): KitchenEvent {
	return event({
		kind: 'BOUGHT',
		itemKey,
		quantity,
		unit,
		occurredAt: at(day, 10),
		expiresAt: options.expiresInDays === undefined ? null : at(day + options.expiresInDays, 10),
		payload: { category: options.category ?? null }
	});
}

export function cooked(
	day: number,
	ingredients: UsedIngredient[],
	options: { portions?: number; plannedMealId?: string } = {}
): KitchenEvent {
	return event({
		kind: 'COOKED',
		occurredAt: at(day, 19),
		portions: options.portions ?? null,
		plannedMealId: options.plannedMealId ?? null,
		payload: { ingredients }
	});
}

export function corrected(
	kind: 'CORRECTED_GONE' | 'CORRECTED_STILL_GOOD' | 'CORRECTED_QUANTITY',
	itemKey: string,
	day: number,
	quantity?: number
): KitchenEvent {
	return event({ kind, itemKey, occurredAt: at(day, 20), quantity: quantity ?? null });
}
