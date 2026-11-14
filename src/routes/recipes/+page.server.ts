import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { TasteProfileController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import type { RecipeSource } from '$lib/models/recipes';

/** How many recipes get kitchen-match and compatibility notes on the door. */
const MATCHED_RECIPE_LIMIT = 200;

type DeletedRecipeIngredientInput = {
	name: string;
	quantity: string;
	unit: string;
	unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	optional: boolean;
	notes: string | null;
	orderIndex: number;
};

type DeletedRecipeInput = {
	title: string;
	description?: string | null;
	instructions: string;
	servings?: number;
	prepTime?: number | null;
	cookTime?: number | null;
	cuisineType?: string | null;
	estimatedCalories?: number | null;
	source?: RecipeSource;
	sourceReceiptId?: string | null;
	imageUrl?: string | null;
	imageStatus?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	isPublic?: boolean;
	ingredients: DeletedRecipeIngredientInput[];
};

function parseDeletedRecipeInput(raw: FormDataEntryValue | null): DeletedRecipeInput | null {
	if (!raw || typeof raw !== 'string') return null;

	try {
		const parsed = JSON.parse(raw) as Partial<DeletedRecipeInput>;
		if (!parsed || typeof parsed !== 'object') return null;
		if (typeof parsed.title !== 'string' || parsed.title.trim().length === 0) return null;
		if (typeof parsed.instructions !== 'string' || parsed.instructions.trim().length === 0)
			return null;
		if (!Array.isArray(parsed.ingredients)) return null;

		const ingredients = parsed.ingredients
			.map((ingredient, index) => {
				if (!ingredient || typeof ingredient !== 'object') return null;
				if (typeof ingredient.name !== 'string' || ingredient.name.trim().length === 0) return null;
				if (typeof ingredient.quantity !== 'string') return null;
				if (typeof ingredient.unit !== 'string') return null;

				const unitType =
					ingredient.unitType === 'WEIGHT' ||
					ingredient.unitType === 'VOLUME' ||
					ingredient.unitType === 'COUNT'
						? ingredient.unitType
						: 'COUNT';

				return {
					name: ingredient.name,
					quantity: ingredient.quantity,
					unit: ingredient.unit,
					unitType,
					optional: Boolean(ingredient.optional),
					notes: typeof ingredient.notes === 'string' ? ingredient.notes : null,
					orderIndex:
						typeof ingredient.orderIndex === 'number' && Number.isFinite(ingredient.orderIndex)
							? ingredient.orderIndex
							: index
				};
			})
			.filter((ingredient) => ingredient !== null) as DeletedRecipeIngredientInput[];

		return {
			title: parsed.title,
			description: typeof parsed.description === 'string' ? parsed.description : null,
			instructions: parsed.instructions,
			servings:
				typeof parsed.servings === 'number' && Number.isFinite(parsed.servings)
					? parsed.servings
					: 2,
			prepTime:
				typeof parsed.prepTime === 'number' && Number.isFinite(parsed.prepTime)
					? parsed.prepTime
					: null,
			cookTime:
				typeof parsed.cookTime === 'number' && Number.isFinite(parsed.cookTime)
					? parsed.cookTime
					: null,
			cuisineType: typeof parsed.cuisineType === 'string' ? parsed.cuisineType : null,
			estimatedCalories:
				typeof parsed.estimatedCalories === 'number' && Number.isFinite(parsed.estimatedCalories)
					? parsed.estimatedCalories
					: null,
			source:
				parsed.source === 'GENERATED' ||
				parsed.source === 'RAG' ||
				parsed.source === 'USER' ||
				parsed.source === 'SNAPPED'
					? parsed.source
					: 'USER',
			sourceReceiptId: typeof parsed.sourceReceiptId === 'string' ? parsed.sourceReceiptId : null,
			imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : null,
			imageStatus:
				parsed.imageStatus === 'QUEUED' ||
				parsed.imageStatus === 'PROCESSING' ||
				parsed.imageStatus === 'DONE' ||
				parsed.imageStatus === 'FAILED'
					? parsed.imageStatus
					: 'QUEUED',
			isPublic: Boolean(parsed.isPublic),
			ingredients
		};
	} catch {
		return null;
	}
}

/** Per recipe: how much of it the kitchen holds and whether it suits the person. */
export interface RecipeFit {
	matchPercentage: number;
	missingIngredients: string[];
	compatible: boolean;
	notes: string[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) {
		throw redirect(302, '/login');
	}
	const actor = locals.actor;

	const recipeController = AppFactory.getRecipeController();
	const pantryController = AppFactory.getPantryController();
	const tasteProfileController = new TasteProfileController(AppFactory.getTasteProfileService());

	const fitPromise = Promise.all([
		recipeController.getHouseholdRecipesWithIngredients(actor, MATCHED_RECIPE_LIMIT),
		pantryController.getHouseholdPantry(actor)
	]).then(async ([recipes, pantry]) => {
		const pantryNames = pantry.map((item) => item.itemName.toLowerCase());
		const entries = await Promise.all(
			recipes.map(async (recipe): Promise<[string, RecipeFit]> => {
				const missingIngredients = recipe.ingredients
					.map((ing) => ing.name)
					.filter((name) => {
						const lower = name.toLowerCase();
						return !pantryNames.some((item) => item.includes(lower) || lower.includes(item));
					});
				const total = recipe.ingredients.length;
				const compatibility = await tasteProfileController.checkCompatibility(
					actor.userId,
					recipe.id
				);
				return [
					recipe.id,
					{
						matchPercentage: total > 0 ? (total - missingIngredients.length) / total : 0,
						missingIngredients,
						compatible: compatibility.compatible,
						notes: compatibility.compatible ? compatibility.warnings : compatibility.blockers
					}
				];
			})
		);
		return Object.fromEntries(entries) as Record<string, RecipeFit>;
	});

	return { streamed: { fit: fitPromise } };
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const recipeId = formData.get('recipeId');

		if (!recipeId || typeof recipeId !== 'string') {
			throw error(400, 'Recipe ID is required');
		}

		const recipeController = AppFactory.getRecipeController();

		try {
			const recipe = await recipeController.getRecipe(recipeId, locals.actor);
			if (!recipe) {
				throw error(404, 'Recipe not found');
			}

			await recipeController.deleteRecipe(recipeId, locals.actor);

			return {
				success: true,
				deletedRecipe: {
					title: recipe.title,
					description: recipe.description,
					instructions: recipe.instructions,
					servings: recipe.servings,
					prepTime: recipe.prepTime,
					cookTime: recipe.cookTime,
					cuisineType: recipe.cuisineType,
					estimatedCalories: recipe.estimatedCalories,
					source: recipe.source,
					sourceReceiptId: recipe.sourceReceiptId,
					imageUrl: recipe.imageUrl,
					imageStatus: recipe.imageStatus,
					isPublic: recipe.isPublic,
					ingredients: recipe.ingredients.map((ingredient) => ({
						name: ingredient.name,
						quantity: ingredient.quantity,
						unit: ingredient.unit,
						unitType: ingredient.unitType,
						optional: ingredient.optional,
						notes: ingredient.notes,
						orderIndex: ingredient.orderIndex
					}))
				}
			};
		} catch {
			throw error(403, 'Not allowed to delete this recipe');
		}
	},

	restore: async ({ locals, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const parsed = parseDeletedRecipeInput(formData.get('recipe'));

		if (!parsed) {
			return fail(400, { error: 'Valid recipe snapshot is required' });
		}

		const recipeRepository = AppFactory.getRecipeRepository();
		const ingredientRepository = AppFactory.getRecipeIngredientRepository();
		const recentRecipes = await recipeRepository.findByHouseholdIdWithIngredients(
			locals.actor.householdId,
			10
		);

		const idempotentMatch = recentRecipes.find(
			(recipe) => recipe.title === parsed.title && recipe.instructions === parsed.instructions
		);

		if (idempotentMatch) {
			return { success: true, restoredRecipeId: idempotentMatch.id, idempotent: true };
		}

		const restored = await recipeRepository.create({
			userId: locals.actor.userId,
			householdId: locals.actor.householdId,
			title: parsed.title,
			description: parsed.description ?? null,
			instructions: parsed.instructions,
			servings: parsed.servings ?? 2,
			prepTime: parsed.prepTime ?? null,
			cookTime: parsed.cookTime ?? null,
			cuisineType: parsed.cuisineType ?? null,
			estimatedCalories: parsed.estimatedCalories ?? null,
			source: parsed.source ?? 'USER',
			sourceReceiptId: parsed.sourceReceiptId ?? null
		});

		if (parsed.ingredients.length > 0) {
			await ingredientRepository.createMany(
				parsed.ingredients.map((ingredient, index) => ({
					recipeId: restored.id,
					name: ingredient.name,
					quantity: ingredient.quantity,
					unit: ingredient.unit,
					unitType: ingredient.unitType,
					optional: ingredient.optional ?? false,
					notes: ingredient.notes ?? null,
					orderIndex: ingredient.orderIndex ?? index
				}))
			);
		}

		await recipeRepository.update(restored.id, {
			imageUrl: parsed.imageUrl ?? null,
			imageStatus: parsed.imageStatus ?? 'QUEUED',
			isPublic: parsed.isPublic ?? false
		});

		return { success: true, restoredRecipeId: restored.id, idempotent: false };
	},

	addToShopping: async ({ locals, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const recipeId = formData.get('recipeId')?.toString();

		if (!recipeId) {
			return fail(400, { error: 'Recipe ID is required' });
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.actor);
			await listController.addRecipeIngredients(locals.actor, list.id, recipeId);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add to shopping list'
			});
		}
	}
};
