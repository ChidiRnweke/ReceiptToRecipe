import { v4 as uuid } from 'uuid';
import { TECHNIQUES } from '../../src/lib/models/recipes';
import type { IRecipeStepRepository } from '../../src/lib/repositories/interfaces/IRecipeRepositories';
import type { NewRecipeStepDao, RecipeStepDao } from '../../src/lib/repositories/daos';

export class InMemoryRecipeStepRepository implements IRecipeStepRepository {
	private steps = new Map<string, RecipeStepDao[]>();

	async findByRecipeId(recipeId: string): Promise<RecipeStepDao[]> {
		return [...(this.steps.get(recipeId) ?? [])];
	}

	async replaceForRecipe(recipeId: string, steps: NewRecipeStepDao[]): Promise<RecipeStepDao[]> {
		const stored = [...steps]
			.sort((a, b) => a.position - b.position)
			.map((step) => ({
				id: uuid(),
				recipeId,
				...step,
				techniqueKey: step.verb ? TECHNIQUES[step.verb].key : null
			}));
		this.steps.set(recipeId, stored);
		return [...stored];
	}
}
