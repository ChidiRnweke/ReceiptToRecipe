import type { Weekday } from '$lib/models/kitchen';
import type { ShopBefore, TonightSlot } from '$lib/models/tonight';
import { listNames } from './items';

export const WEEKDAY_NAMES = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
] as const;

export function weekdayName(weekday: Weekday): string {
	return WEEKDAY_NAMES[weekday];
}

/** "Noor" from "Noor Haddad". */
export function firstName(displayName: string): string {
	return displayName.trim().split(/\s+/)[0] || displayName;
}

/** The door's question, with the highlighted word in stars. */
export function tonightQuestion(slot: TonightSlot, tomorrow: boolean): string {
	if (tomorrow) return 'Tomorrow’s *dinner*';
	return slot === 'lunch' ? 'What’s for *lunch*?' : 'What’s for *dinner*?';
}

const plural = (name: string) => /s$/.test(name);

/** "uses the spinach before it goes", "uses the spinach and feta before they go". */
export function usesChip(uses: string[]): string {
	const many = uses.length > 1 || plural(uses[0] ?? '');
	return `uses the ${listNames(uses)} before ${many ? 'they go' : 'it goes'}`;
}

/** Whether the meal can be cooked from what is home, or what still has to come in. */
export function availabilityLine(missing: string[], shopBefore: ShopBefore | null): string {
	if (missing.length === 0) return 'everything’s home';
	const names = listNames(missing);
	if (shopBefore) {
		if (shopBefore.shopper) {
			return `${names} ${missing.length > 1 ? 'come' : 'comes'} in ${shopBefore.shopper}’s shop`;
		}
		const when =
			shopBefore.daysAway === 0
				? 'today'
				: shopBefore.daysAway === 1
					? 'tomorrow'
					: weekdayName(shopBefore.weekday);
		return `${names} ${missing.length > 1 ? 'come' : 'comes'} in ${when}’s shop`;
	}
	return `pick up ${names} on the way`;
}

export interface EatOutCopy {
	title: string | null;
	movedToDays: number | null;
	movedToWeekday: Weekday | null;
	keptBy: { itemKey: string; weekday: Weekday } | null;
	firstInLine: { itemKey: string; tonight: boolean } | null;
}

/** The toast after "We're eating out". */
export function eatOutMessage(result: EatOutCopy): string {
	const { title, keptBy } = result;
	if (!title) {
		const first = result.firstInLine;
		if (!first) return 'Enjoy! Nothing at home needs eating tonight.';
		return `Enjoy! The ${first.itemKey} won’t last past ${first.tonight ? 'tonight' : 'tomorrow'}, so it’s first in line tomorrow.`;
	}
	if (result.movedToDays !== null && result.movedToWeekday !== null) {
		const when = result.movedToDays === 1 ? 'tomorrow' : weekdayName(result.movedToWeekday);
		const lead = keptBy
			? `The ${keptBy.itemKey} ${plural(keptBy.itemKey) ? 'keep' : 'keeps'} till ${weekdayName(keptBy.weekday)}, so ${title.toLowerCase()}`
			: title;
		return `Enjoy! ${lead} is ${when} now.`;
	}
	return `Enjoy! ${title} is off the plan${keptBy ? `, and the ${keptBy.itemKey} is in Use it up` : ''}.`;
}

export interface PickCopy {
	title: string;
	slot: TonightSlot;
	tomorrow: boolean;
	moved: { title: string; weekday: Weekday } | null;
	missing: string[];
}

/** The toast after picking something else. */
export function pickMessage(pick: PickCopy): string {
	const when = pick.tomorrow ? 'tomorrow' : pick.slot === 'lunch' ? 'for lunch' : 'tonight';
	let message = `${pick.title} ${when}.`;
	if (pick.moved) message += ` ${pick.moved.title} moves to ${weekdayName(pick.moved.weekday)}.`;
	if (pick.missing.length) message += ` Pick up ${listNames(pick.missing)} on the way.`;
	return message;
}

/** Recipe instructions are stored as one text; each non-empty line is a step. */
export function splitSteps(instructions: string): string[] {
	return instructions
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/** "450 g", "1.5 l", "2 cloves": a scaled amount, rounded the way a cook reads it. */
export function formatAmount(quantity: number, unit: string): string {
	const u = unit.trim();
	if (u === 'ml' && quantity >= 1000) return `${Math.round(quantity / 100) / 10} l`;
	if (u === 'g' && quantity >= 1000) return `${Math.round(quantity / 100) / 10} kg`;
	if (u === 'g' || u === 'ml') {
		return `${quantity >= 100 ? Math.round(quantity / 10) * 10 : Math.round(quantity)} ${u}`;
	}
	const rounded = Math.round(quantity * 2) / 2;
	const amount = String(rounded);
	if (!u || u === 'count' || u === 'piece' || u === 'pieces') return amount;
	return `${amount} ${u}`;
}
