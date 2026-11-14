import type { Actor } from '$lib/models/household';
import type { HabitAnswer, HabitAnswerValue, Habits } from '$lib/models/kitchen';

export interface IHabitService {
	/**
	 * The household's learned routines with its answers applied: declined offers dropped,
	 * accepted ones kept. Local days use `timeZone`, or the household's stored one.
	 */
	getHabits(householdId: string, now: Date, timeZone?: string): Promise<Habits>;
	answerOffer(actor: Actor, key: string, answer: HabitAnswerValue, at: Date): Promise<HabitAnswer>;
}
