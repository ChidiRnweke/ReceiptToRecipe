import type { CookbookStructure } from '../../src/lib/models/recipes';
import type {
	IRecipeIngredientRepository,
	IRecipeRepository,
	IRecipeStepRepository
} from '../../src/lib/repositories/interfaces/IRecipeRepositories';
import type { NewCookbookRecipeDao } from '../../src/lib/repositories/daos';
import { CookbookService } from '../../src/lib/services/CookbookService';
import { cookbookTags, itemKeysOf } from '../../src/lib/services/recipes/cookbookText';
import { wikibooksUrls } from '../../src/lib/models/recipes';
import { InMemoryCookbookRecipeRepository } from './InMemoryCookbookRecipeRepository';
import { InMemoryRecipeStepRepository } from './InMemoryRecipeStepRepository';

let nextPage = 1000;

/** A structured catalog recipe; pass what the test is about. */
export function cookbookStructure(
	title: string,
	ingredients: string[],
	extra: Partial<CookbookStructure> = {}
): CookbookStructure {
	return {
		title,
		description: `${title}, from the cookbook.`,
		servings: 4,
		prepTime: 15,
		cookTime: 30,
		cuisine: null,
		ingredients: ingredients.map((name) => ({
			name,
			quantity: 1,
			unit: '',
			optional: false,
			notes: null
		})),
		steps: [
			{ verb: null, text: 'Chop everything.', minutes: null },
			{ verb: 'Simmer', text: 'until done.', minutes: 20 }
		],
		tags: ['main'],
		...extra
	};
}

/** The row the importer would write for a structured recipe. */
export function cookbookRow(recipe: CookbookStructure, pageId = nextPage++): NewCookbookRecipeDao {
	const pageTitle = `Cookbook:${recipe.title}`;
	return {
		pageId,
		revisionId: 1,
		title: recipe.title,
		pageTitle,
		sourceUrl: wikibooksUrls(pageTitle).pageUrl,
		licence: 'CC BY-SA 4.0',
		recipe,
		tags: cookbookTags(recipe),
		cuisine: recipe.cuisine,
		itemKeys: itemKeysOf(recipe),
		structuredBy: 'rules',
		embedding: null
	};
}

/** The cookbook service over the in-memory catalog and the given household recipe stores. */
export function createCookbook(
	recipes: IRecipeRepository,
	ingredients: IRecipeIngredientRepository,
	steps: IRecipeStepRepository = new InMemoryRecipeStepRepository()
) {
	const catalog = new InMemoryCookbookRecipeRepository(recipes);
	const service = new CookbookService(catalog, recipes, ingredients, steps);

	/** Adds a recipe to the catalog and returns it. */
	async function addCatalogRecipe(
		title: string,
		ingredientNames: string[],
		extra: Partial<CookbookStructure> = {}
	) {
		return catalog.upsert(cookbookRow(cookbookStructure(title, ingredientNames, extra)));
	}

	return { catalog, service, steps, addCatalogRecipe };
}
