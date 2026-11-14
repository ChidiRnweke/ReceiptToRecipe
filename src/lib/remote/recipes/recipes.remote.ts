import { command, form, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import {
	cravingInput,
	listMineInput,
	snapRecipeInput,
	toggleSaveInput,
	type MyRecipes,
	type RecipeCardResult
} from '$lib/models/recipes';
import { NoRecipeInImageError } from '$lib/services';
import type { SnappedRecipe } from '$lib/controllers';
import { requireActor } from '../actor';

/** One tab of "My recipes", with the count of every tab. */
export const listMine = query(listMineInput, async (tab): Promise<MyRecipes> => {
	const actor = requireActor();
	return AppFactory.getRecipesDoorController().listMine(actor, tab);
});

/** Makes up a recipe for a craving. "Another one" passes the titles already shown. */
export const makeSomethingNew = command(
	cravingInput,
	async ({ text, previousTitles }): Promise<RecipeCardResult> => {
		const actor = requireActor();
		return AppFactory.getRecipesDoorController().craving(actor, text, previousTitles);
	}
);

/** Reads a recipe from a photo of a cookbook page, a screenshot or a dish. */
export const snapRecipe = form(snapRecipeInput, async ({ photo }): Promise<SnappedRecipe> => {
	const actor = requireActor();
	try {
		return await AppFactory.getRecipesDoorController().snap(actor, {
			bytes: new Uint8Array(await photo.arrayBuffer()),
			name: photo.name || 'recipe.jpg',
			mimeType: photo.type
		});
	} catch (cause) {
		if (cause instanceof NoRecipeInImageError) {
			error(422, 'We could not find a recipe or a dish in that photo. Try another one.');
		}
		throw cause;
	}
});

/** Saves a recipe for the signed-in person, or takes it out of their saved recipes. */
export const toggleSave = command(
	toggleSaveInput,
	async ({ recipeId, saved }): Promise<{ saved: boolean }> => {
		const actor = requireActor();
		const controller = AppFactory.getRecipeController();
		if (saved) await controller.saveRecipe(actor, recipeId);
		else await controller.unsaveRecipe(actor, recipeId);
		return { saved };
	}
);
