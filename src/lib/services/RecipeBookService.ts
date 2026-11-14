import type {
	IRecipeIngredientRepository,
	IRecipeRepository,
	IRecipeStepRepository,
	NewRecipeIngredientDao,
	RecipeDao,
	RecipeStepDao
} from '$repositories';
import type { RecipeStep } from '$lib/models/recipes';
import type { IImageGenerator } from './interfaces/IImageGenerator';
import type { IJobQueue } from './interfaces/IJobQueue';
import type { KitchenAuthor } from './interfaces/IKitchenService';
import type { GeneratedRecipe } from './interfaces/ICulinaryIntelligence';
import type { IRecipeBookService, NewRecipeContent } from './interfaces/IRecipeBookService';
import { formatInstructions, stepsFromGenerated, stepsFromInstructions } from './recipes';

const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb', 'lbs', 'mg'];
const VOLUME_UNITS = ['ml', 'l', 'cup', 'cups', 'tbsp', 'tsp', 'fl oz', 'pint', 'quart', 'gallon'];

function unitTypeOf(unit: string): 'WEIGHT' | 'VOLUME' | 'COUNT' {
	const lower = unit.toLowerCase();
	if (WEIGHT_UNITS.includes(lower)) return 'WEIGHT';
	if (VOLUME_UNITS.includes(lower)) return 'VOLUME';
	return 'COUNT';
}

function toStep(row: RecipeStepDao): RecipeStep {
	return { position: row.position, verb: row.verb, text: row.text, minutes: row.minutes };
}

export class RecipeBookService implements IRecipeBookService {
	constructor(
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private recipeStepRepository: IRecipeStepRepository,
		private imageGenerator: IImageGenerator,
		private jobQueue: IJobQueue
	) {}

	async create(author: KitchenAuthor, content: NewRecipeContent): Promise<RecipeDao> {
		const { recipe: generated, source } = content;
		const steps = stepsFromGenerated(generated);
		const recipe = await this.recipeRepository.create({
			userId: author.userId,
			householdId: author.householdId,
			sourceReceiptId: content.sourceReceiptId ?? null,
			title: generated.title,
			description: generated.description,
			instructions: formatInstructions(steps),
			servings: generated.servings,
			prepTime: generated.prepTime,
			cookTime: generated.cookTime,
			cuisineType: generated.cuisineType,
			estimatedCalories: generated.estimatedCalories,
			source,
			...(content.photoUrl ? { imageUrl: content.photoUrl, imageStatus: 'DONE' as const } : {})
		});

		const ingredients: NewRecipeIngredientDao[] = generated.ingredients.map((ing, index) => ({
			recipeId: recipe.id,
			name: ing.name,
			quantity: ing.quantity.toString(),
			unit: ing.unit,
			unitType: unitTypeOf(ing.unit),
			optional: ing.optional || false,
			notes: ing.notes,
			orderIndex: index
		}));
		await this.recipeIngredientRepository.createMany(ingredients);
		await this.recipeStepRepository.replaceForRecipe(recipe.id, steps);

		if (!content.photoUrl) this.queuePicture(recipe.id, generated);
		return recipe;
	}

	async replaceSteps(recipeId: string, steps: RecipeStep[]): Promise<RecipeStep[]> {
		const saved = await this.recipeStepRepository.replaceForRecipe(recipeId, steps);
		await this.recipeRepository.update(recipeId, { instructions: formatInstructions(steps) });
		return saved.map(toStep);
	}

	async stepsOf(recipe: Pick<RecipeDao, 'id' | 'instructions'>): Promise<RecipeStep[]> {
		const rows = await this.recipeStepRepository.findByRecipeId(recipe.id);
		return rows.length > 0 ? rows.map(toStep) : stepsFromInstructions(recipe.instructions);
	}

	/** Generates the recipe's picture in the background; a failure marks the picture FAILED. */
	private queuePicture(recipeId: string, generated: GeneratedRecipe): void {
		const run = async () => {
			try {
				await this.recipeRepository.update(recipeId, { imageStatus: 'PROCESSING' });
				const image = await this.imageGenerator.generateRecipeImage(
					generated.title,
					generated.description,
					generated.ingredients.slice(0, 5).map((ingredient) => ingredient.name)
				);
				await this.recipeRepository.update(recipeId, { imageUrl: image.url, imageStatus: 'DONE' });
			} catch (error) {
				console.error(`Picture generation failed for recipe ${recipeId}:`, error);
				await this.recipeRepository.update(recipeId, { imageStatus: 'FAILED' });
			}
		};
		this.jobQueue.add({ name: `recipe-image:${recipeId}`, run }).catch((error) => {
			console.error(`Could not queue the picture for recipe ${recipeId}:`, error);
		});
	}
}
