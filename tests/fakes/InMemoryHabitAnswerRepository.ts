import type { IHabitAnswerRepository } from '../../src/lib/repositories/interfaces/IHabitAnswerRepository';
import type { HabitAnswer, HabitAnswerValue } from '../../src/lib/models/kitchen';

export class InMemoryHabitAnswerRepository implements IHabitAnswerRepository {
	private answers = new Map<string, HabitAnswer>();

	async save(answer: {
		householdId: string;
		key: string;
		answer: HabitAnswerValue;
		answeredBy: string | null;
		answeredAt: Date;
	}): Promise<HabitAnswer> {
		const stored: HabitAnswer = { ...answer };
		this.answers.set(`${answer.householdId}|${answer.key}`, stored);
		return stored;
	}

	async listByHousehold(householdId: string): Promise<HabitAnswer[]> {
		return [...this.answers.values()].filter((answer) => answer.householdId === householdId);
	}
}
