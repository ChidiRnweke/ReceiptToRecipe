import { asc, eq } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import { TECHNIQUES, isTechniqueVerb } from '$lib/models/recipes';
import type { IRecipeStepRepository } from './interfaces';
import type { NewRecipeStepDao, RecipeStepDao } from './daos';

export class RecipeStepRepository implements IRecipeStepRepository {
	constructor(private db: Database) {}

	async findByRecipeId(recipeId: string): Promise<RecipeStepDao[]> {
		const rows = await this.db.query.recipeSteps.findMany({
			where: eq(schema.recipeSteps.recipeId, recipeId),
			orderBy: [asc(schema.recipeSteps.position)]
		});
		return rows.map((row) => this.toDao(row));
	}

	async replaceForRecipe(recipeId: string, steps: NewRecipeStepDao[]): Promise<RecipeStepDao[]> {
		return this.db.transaction(async (tx) => {
			await tx.delete(schema.recipeSteps).where(eq(schema.recipeSteps.recipeId, recipeId));
			if (steps.length === 0) return [];
			const rows = await tx
				.insert(schema.recipeSteps)
				.values(
					steps.map((step) => ({
						recipeId,
						position: step.position,
						verb: step.verb,
						text: step.text,
						minutes: step.minutes,
						techniqueKey: step.verb ? TECHNIQUES[step.verb].key : null
					}))
				)
				.returning();
			return rows.sort((a, b) => a.position - b.position).map((row) => this.toDao(row));
		});
	}

	private toDao(row: typeof schema.recipeSteps.$inferSelect): RecipeStepDao {
		// A verb that left the vocabulary goes back into the sentence, so the step reads the same.
		const verb = isTechniqueVerb(row.verb) ? row.verb : null;
		return {
			id: row.id,
			recipeId: row.recipeId,
			position: row.position,
			verb,
			text: verb || !row.verb ? row.text : `${row.verb} ${row.text}`.trim(),
			minutes: row.minutes,
			techniqueKey: row.techniqueKey
		};
	}
}
