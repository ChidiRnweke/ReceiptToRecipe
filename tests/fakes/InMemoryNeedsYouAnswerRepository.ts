import type {
	INeedsYouAnswerRepository,
	NeedsYouAnswer
} from '../../src/lib/repositories/interfaces/INeedsYouAnswerRepository';

export class InMemoryNeedsYouAnswerRepository implements INeedsYouAnswerRepository {
	private answers = new Map<string, NeedsYouAnswer>();

	async save(answer: NeedsYouAnswer): Promise<NeedsYouAnswer> {
		this.answers.set(`${answer.householdId}|${answer.userId}|${answer.key}`, { ...answer });
		return answer;
	}

	async listKeys(householdId: string, userId: string): Promise<string[]> {
		return [...this.answers.values()]
			.filter((a) => a.householdId === householdId && a.userId === userId)
			.map((a) => a.key);
	}
}
