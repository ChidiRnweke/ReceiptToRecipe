import type {
	IRecipeIngredientRepository,
	IRecipeRepository,
	IRecipeStepRepository,
	NewRecipeIngredientDao,
	RecipeDao,
	RecipeStepDao
} from '$repositories';
import type { JudgedTag, RecipeStep } from '$lib/models/recipes';
import type { IImageGenerator } from './interfaces/IImageGenerator';
import type { IJobQueue } from './interfaces/IJobQueue';
import type { KitchenAuthor } from './interfaces/IKitchenService';
import type { GeneratedRecipe } from './interfaces/ICulinaryIntelligence';
import type {
	IRecipeBookService,
	NewRecipeContent,
	RecipeTagger,
	TaggingSummary
} from './interfaces/IRecipeBookService';
import {
	combineTags,
	deriveTags,
	formatInstructions,
	stepsFromGenerated,
	stepsFromInstructions
} from './recipes';

/** Recipes per model call when tagging. */
const TAG_BATCH = 20;

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
		private jobQueue: IJobQueue,
		private tagger: RecipeTagger
	) {}

	async create(author: KitchenAuthor, content: NewRecipeContent): Promise<RecipeDao> {
		const { recipe: generated, source } = content;
		const steps = stepsFromGenerated(generated);
		const rule = deriveTags(
			{ prepTime: generated.prepTime, cookTime: generated.cookTime },
			generated.ingredients,
			steps
		);
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
			...combineTags(rule, generated.tags ?? null),
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

	async retag(recipeId: string): Promise<void> {
		const recipe = await this.recipeRepository.findByIdWithIngredients(recipeId);
		if (!recipe) throw new Error('Recipe not found');
		const rule = deriveTags(recipe, recipe.ingredients, await this.stepsOf(recipe));
		await this.recipeRepository.update(recipeId, combineTags(rule, recipe.tagSource?.ai ?? null));
	}

	async tagUntagged(): Promise<TaggingSummary> {
		const summary: TaggingSummary = { tagged: 0, judged: 0 };
		let modelUp = true;
		let afterId: string | null = null;
		for (;;) {
			const batch = await this.recipeRepository.findNeedingTags(afterId, TAG_BATCH);
			if (batch.length === 0) return summary;
			afterId = batch[batch.length - 1].id;

			const withSteps = await Promise.all(
				batch.map(async (recipe) => ({ recipe, steps: await this.stepsOf(recipe) }))
			);
			let judged = new Map<string, JudgedTag[]>();
			if (modelUp) {
				try {
					const answer = await this.tagger.tagRecipes(
						withSteps.map(({ recipe, steps }) => ({
							id: recipe.id,
							title: recipe.title,
							ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
							steps: steps.map((step) => (step.verb ? `${step.verb} ${step.text}` : step.text))
						}))
					);
					judged = new Map(answer.map((entry) => [entry.id, entry.tags]));
				} catch (error) {
					modelUp = false;
					console.error('The model could not tag recipes; using the rule tags only:', error);
				}
			}

			for (const { recipe, steps } of withSteps) {
				const rule = deriveTags(recipe, recipe.ingredients, steps);
				const fromModel = judged.get(recipe.id) ?? null;
				await this.recipeRepository.update(recipe.id, combineTags(rule, fromModel));
				summary.tagged++;
				if (fromModel) summary.judged++;
			}
			if (batch.length < TAG_BATCH) return summary;
		}
	}

	async queueTagging(): Promise<TaggingSummary> {
		let summary: TaggingSummary = { tagged: 0, judged: 0 };
		await this.jobQueue.add({
			name: 'recipe-tags',
			run: async () => {
				summary = await this.tagUntagged();
			}
		});
		return summary;
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
