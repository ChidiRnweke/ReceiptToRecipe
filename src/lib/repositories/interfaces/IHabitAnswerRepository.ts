import type { HabitAnswer, HabitAnswerValue } from '$lib/models/kitchen';

export interface IHabitAnswerRepository {
	/** Records the answer to an offer, replacing an earlier answer to the same offer. */
	save(answer: {
		householdId: string;
		key: string;
		answer: HabitAnswerValue;
		answeredBy: string | null;
		answeredAt: Date;
	}): Promise<HabitAnswer>;
	listByHousehold(householdId: string): Promise<HabitAnswer[]>;
}
