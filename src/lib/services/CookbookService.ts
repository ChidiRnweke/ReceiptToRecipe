import {
	attributionOf,
	cookbookIdOf,
	cookbookRef,
	type CookbookAttribution,
	type CookbookRecipe,
	type RecipeTag
} from '$lib/models/recipes';
import type { Actor } from '$lib/models/household';
import type {
	ICookbookRecipeRepository,
	IRecipeIngredientRepository,
	IRecipeRepository,
	IRecipeStepRepository,
	RecipeDao,
	RecipeWithIngredientsDao
} from '$repositories';
import type { CookbookOffer, CookbookPreview, ICookbookService } from './interfaces/ICookbook';
import { formatInstructions } from './recipes/steps';
import { tagsSatisfying } from './recipes/tags';
import { unitTypeOf } from './recipes/unitType';

/** A catalog recipe in the shape household recipes have, with its `cookbook-<uuid>` id. */
export function asHouseholdRecipe(recipe: CookbookRecipe): RecipeWithIngredientsDao {
	const id = cookbookRef(recipe.id);
	const structure = recipe.recipe;
	return {
		id,
		userId: '',
		householdId: '',
		sourceReceiptId: null,
		title: structure.title,
		description: structure.description || null,
		instructions: formatInstructions(
			structure.steps.map((step, position) => ({ position, verb: step.verb, text: step.text }))
		),
		servings: structure.servings,
		prepTime: structure.prepTime,
		cookTime: structure.cookTime,
		imageUrl: recipe.imageUrl,
		imageStatus: recipe.imageStatus,
		imageSource: recipe.imageSource,
		imageCredit: recipe.imageCredit,
		source: 'COOKBOOK',
		cuisineType: recipe.cuisine,
		estimatedCalories: null,
		isPublic: true,
		tags: recipe.tags,
		tagSource: null,
		cookbookRecipeId: recipe.id,
		createdAt: recipe.importedAt,
		updatedAt: recipe.updatedAt,
		ingredients: structure.ingredients.map((ingredient, orderIndex) => ({
			id: `${id}:${orderIndex}`,
			recipeId: id,
			name: ingredient.name,
			quantity: String(ingredient.quantity),
			unit: ingredient.unit,
			unitType: unitTypeOf(ingredient.unit),
			optional: ingredient.optional,
			notes: ingredient.notes,
			orderIndex
		}))
	};
}

function tagGroups(offer: CookbookOffer): RecipeTag[][] {
	return [...offer.dietTags, ...(offer.tags ?? [])].map((tag) => tagsSatisfying(tag));
}

function isUniqueViolation(error: unknown): boolean {
	const code = (error as { code?: string; cause?: { code?: string } })?.code;
	const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
	return code === '23505' || causeCode === '23505';
}

/** The shared cookbook as households see it, and adoption into a household's recipes. */
export class CookbookService implements ICookbookService {
	constructor(
		private cookbookRepository: ICookbookRecipeRepository,
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private recipeStepRepository: IRecipeStepRepository
	) {}

	async candidates(
		householdId: string,
		offer: CookbookOffer & { wanted: string[]; day: number }
	): Promise<RecipeWithIngredientsDao[]> {
		const rows = await this.cookbookRepository.sample({
			tagGroups: tagGroups(offer),
			avoid: offer.avoid,
			householdId,
			wanted: offer.wanted,
			// Main dishes first: the catalog also holds drinks, sauces and dressings.
			preferTags: ['main'],
			seed: `${householdId}:${offer.day}`,
			limit: offer.limit
		});
		return rows.map(asHouseholdRecipe);
	}

	async search(
		householdId: string,
		query: string | null,
		offer: CookbookOffer
	): Promise<RecipeWithIngredientsDao[]> {
		const rows = await this.cookbookRepository.search({
			tagGroups: tagGroups(offer),
			avoid: offer.avoid,
			householdId,
			text: query?.trim() || null,
			embedding: null,
			limit: offer.limit
		});
		return rows.map(asHouseholdRecipe);
	}

	async preview(cookbookRecipeId: string): Promise<CookbookPreview | null> {
		const recipe = await this.cookbookRepository.findById(cookbookRecipeId);
		if (!recipe) return null;
		return {
			recipe: asHouseholdRecipe(recipe),
			steps: recipe.recipe.steps.map((step, position) => ({ position, ...step })),
			attribution: attributionOf(recipe)
		};
	}

	get(cookbookRecipeId: string): Promise<CookbookRecipe | null> {
		return this.cookbookRepository.findById(cookbookRecipeId);
	}

	async attribution(cookbookRecipeId: string): Promise<CookbookAttribution | null> {
		const recipe = await this.cookbookRepository.findById(cookbookRecipeId);
		return recipe ? attributionOf(recipe) : null;
	}

	async adopt(actor: Actor, cookbookRecipeId: string): Promise<RecipeDao> {
		const existing = await this.recipeRepository.findByHouseholdAndCookbookId(
			actor.householdId,
			cookbookRecipeId
		);
		if (existing) return existing;

		const catalog = await this.cookbookRepository.findById(cookbookRecipeId);
		if (!catalog) throw new Error('Recipe not found');
		const structure = catalog.recipe;
		const steps = structure.steps.map((step, position) => ({ position, ...step }));

		let recipe: RecipeDao;
		try {
			recipe = await this.recipeRepository.create({
				userId: actor.userId,
				householdId: actor.householdId,
				title: structure.title,
				description: structure.description || null,
				instructions: formatInstructions(steps),
				servings: structure.servings,
				prepTime: structure.prepTime,
				cookTime: structure.cookTime,
				cuisineType: catalog.cuisine,
				source: 'COOKBOOK',
				cookbookRecipeId: catalog.id,
				tags: catalog.tags,
				tagSource: { rule: catalog.tags, ai: null },
				imageUrl: catalog.imageUrl,
				imageStatus: catalog.imageUrl ? 'DONE' : 'QUEUED',
				imageSource: catalog.imageSource,
				imageCredit: catalog.imageCredit
			});
		} catch (error) {
			// Two taps at once: the other request made the copy first.
			if (!isUniqueViolation(error)) throw error;
			const made = await this.recipeRepository.findByHouseholdAndCookbookId(
				actor.householdId,
				cookbookRecipeId
			);
			if (!made) throw error;
			return made;
		}

		await this.recipeIngredientRepository.createMany(
			structure.ingredients.map((ingredient, orderIndex) => ({
				recipeId: recipe.id,
				name: ingredient.name,
				quantity: String(ingredient.quantity),
				unit: ingredient.unit,
				unitType: unitTypeOf(ingredient.unit),
				optional: ingredient.optional,
				notes: ingredient.notes,
				orderIndex
			}))
		);
		await this.recipeStepRepository.replaceForRecipe(recipe.id, steps);
		return recipe;
	}

	async resolve(actor: Actor, recipeId: string): Promise<string> {
		const cookbookRecipeId = cookbookIdOf(recipeId);
		if (!cookbookRecipeId) return recipeId;
		return (await this.adopt(actor, cookbookRecipeId)).id;
	}
}
