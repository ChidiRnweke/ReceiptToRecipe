import { eq } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IHabitAnswerRepository } from './interfaces';
import type { HabitAnswer, HabitAnswerValue } from '$lib/models/kitchen';

export class HabitAnswerRepository implements IHabitAnswerRepository {
	constructor(private db: Database) {}

	async save(answer: {
		householdId: string;
		key: string;
		answer: HabitAnswerValue;
		answeredBy: string | null;
		answeredAt: Date;
	}): Promise<HabitAnswer> {
		const [row] = await this.db
			.insert(schema.householdHabitAnswers)
			.values(answer)
			.onConflictDoUpdate({
				target: [schema.householdHabitAnswers.householdId, schema.householdHabitAnswers.key],
				set: {
					answer: answer.answer,
					answeredBy: answer.answeredBy,
					answeredAt: answer.answeredAt
				}
			})
			.returning();
		return this.toAnswer(row);
	}

	async listByHousehold(householdId: string): Promise<HabitAnswer[]> {
		const rows = await this.db.query.householdHabitAnswers.findMany({
			where: eq(schema.householdHabitAnswers.householdId, householdId)
		});
		return rows.map((row) => this.toAnswer(row));
	}

	private toAnswer(row: typeof schema.householdHabitAnswers.$inferSelect): HabitAnswer {
		return {
			householdId: row.householdId,
			key: row.key,
			answer: row.answer === 'declined' ? 'declined' : 'accepted',
			answeredBy: row.answeredBy,
			answeredAt: row.answeredAt
		};
	}
}
