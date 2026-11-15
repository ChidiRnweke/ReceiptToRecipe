import { and, eq } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type {
	INeedsYouAnswerRepository,
	NeedsYouAnswer
} from './interfaces/INeedsYouAnswerRepository';

export class NeedsYouAnswerRepository implements INeedsYouAnswerRepository {
	constructor(private db: Database) {}

	async save(answer: NeedsYouAnswer): Promise<NeedsYouAnswer> {
		const [row] = await this.db
			.insert(schema.needsYouAnswers)
			.values(answer)
			.onConflictDoUpdate({
				target: [
					schema.needsYouAnswers.householdId,
					schema.needsYouAnswers.userId,
					schema.needsYouAnswers.key
				],
				set: { answer: answer.answer, answeredAt: answer.answeredAt }
			})
			.returning();
		return {
			householdId: row.householdId,
			userId: row.userId,
			key: row.key,
			answer: row.answer,
			answeredAt: row.answeredAt
		};
	}

	async listKeys(householdId: string, userId: string): Promise<string[]> {
		const rows = await this.db
			.select({ key: schema.needsYouAnswers.key })
			.from(schema.needsYouAnswers)
			.where(
				and(
					eq(schema.needsYouAnswers.householdId, householdId),
					eq(schema.needsYouAnswers.userId, userId)
				)
			);
		return rows.map((row) => row.key);
	}
}
