import type { ShopMethod } from '$lib/models/kitchen';
import { weekdayOfDay } from '../kitchen/days';
import { weekdayName } from '../tonight/copy';
import { listNames } from '../tonight/items';

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** "Tue" for a local day. */
export function shortDay(day: number): string {
	return SHORT_DAYS[weekdayOfDay(day)];
}

/** "Today", "Tomorrow" or the weekday of a dish, with ", prep" for a prep session. */
export function dishWhen(day: number, today: number, prep = false): string {
	const word =
		day === today ? 'Today' : day === today + 1 ? 'Tomorrow' : weekdayName(weekdayOfDay(day));
	return prep ? `${word}, prep` : word;
}

/** "Thursday’s shop" for the learned shop the list is for, else "Next shop". */
export function shopTitle(shopDay: number | null): string {
	return shopDay === null ? 'Next shop' : `${weekdayName(weekdayOfDay(shopDay))}’s shop`;
}

/** "7 things". */
export function thingsCount(count: number): string {
	return `${count} thing${count === 1 ? '' : 's'}`;
}

/** The end buttons, in the order this member usually finishes a shop. */
export function endButtons(habit: ShopMethod): ('receipt' | 'tick')[] {
	return habit === 'TICK' ? ['tick', 'receipt'] : ['receipt', 'tick'];
}

/** The line under the end buttons. */
export function endHint(habit: ShopMethod): string {
	return habit === 'TICK'
		? 'Got everything fills the kitchen from what you ticked, or the whole list if you ticked nothing.'
		: 'The receipt shows what really came home. No receipt? Got everything works too.';
}

const plural = (name: string) => /s$/.test(name);

/** "not on the receipt, so it stays on your list". */
export function staysLine(name: string): string {
	return `not on the receipt, so ${plural(name) ? 'they stay' : 'it stays'} on your list`;
}

/** The toast after "Looks right". */
export function cameHomeMessage(lines: number, missing: string[]): string {
	const names = missing.map((name) => name.toLowerCase());
	const tail = names.length
		? `, and ${listNames(names)} ${names.length > 1 || plural(names[0]) ? 'are' : 'is'} still on the list`
		: '';
	return `Got it. ${lines} thing${lines === 1 ? '' : 's'} in the kitchen${tail}.`;
}

/** The toast after "Got everything". */
export function gotEverythingMessage(tracks: boolean, plannedIdeas: boolean): string {
	if (plannedIdeas && !tracks) return 'Enjoy. Those dinners are in your days now.';
	return 'All in the kitchen. Nothing to type.';
}
