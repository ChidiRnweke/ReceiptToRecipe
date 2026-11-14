import type { Actor } from '$lib/models/household';
import type { HabitAnswer, HabitAnswerValue, Habits } from '$lib/models/kitchen';

export interface IHabitService {
	/** The household's learned routines, without the offers it declined. */
	getHabits(householdId: string, now: Date, timeZone: string): Promise<Habits>;
	answerOffer(actor: Actor, key: string, answer: HabitAnswerValue, at: Date): Promise<HabitAnswer>;
}
