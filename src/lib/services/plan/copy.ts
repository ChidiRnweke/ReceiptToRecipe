import type { PlanningStyle, Weekday } from '$lib/models/kitchen';
import type { PlanStretch } from '$lib/models/plan';
import { weekdayOfDay } from '../kitchen/days';
import { weekdayName } from '../tonight/copy';

export const PLAN_QUESTION = 'What’s the *plan*?';

const dayName = (day: number) => weekdayName(weekdayOfDay(day));

/** The line under the day strip that says which days the plan covers. */
export function stretchLine(stretch: PlanStretch): string {
	switch (stretch.reason) {
		case 'custom':
			return `${dayName(stretch.start)} to ${dayName(stretch.end - 1)}.`;
		case 'until-shop':
			return `Until your ${dayName(stretch.end)} shop.`;
		case 'week':
			return 'The whole week.';
		case 'few':
			return 'The next few days.';
	}
}

/** "From Friday." while the member picks the last day. */
export function pickingLine(start: number): string {
	return `From ${dayName(start)}.`;
}

export function fillLabel(style: PlanningStyle): string {
	return style === 'week' ? 'Plan the whole week' : 'Suggest the rest';
}

export const FILLED_MESSAGE = 'Filled the open meals. Swap anything you don’t fancy.';
export const NOTHING_TO_FILL_MESSAGE = 'Every meal in these days is planned.';
export const NO_RECIPES_MESSAGE = 'No recipes to suggest yet. Make one in Recipes.';
export const JUST_TONIGHT_MESSAGE = 'Just for tonight.';
export const PREP_DONE_MESSAGE = 'Lunch sorted. Boxes in the fridge.';

/** "Saag paneer on Friday." */
export function setSlotMessage(title: string, day: number): string {
	return `${title} on ${dayName(day)}.`;
}

/** "Saturday’s lunch is sorted: spinach & chickpea curry." */
export function twoDaysMessage(title: string, lunchDay: number): string {
	return `${dayName(lunchDay)}’s lunch is sorted: ${title.toLowerCase()}.`;
}

/** "Saag paneer on Friday. Something to look forward to." */
export function discoverMessage(title: string, day: number): string {
	return `${title} on ${dayName(day)}. Something to look forward to.`;
}

/** "4 lunches in the plan, cooked on Sunday." */
export function batchPrepMessage(lunches: number, prepWeekday: Weekday): string {
	return `${lunches} lunch${lunches === 1 ? '' : 'es'} in the plan, cooked on ${weekdayName(prepWeekday)}.`;
}
