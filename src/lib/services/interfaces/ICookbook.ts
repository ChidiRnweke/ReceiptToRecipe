import type { Actor } from '$lib/models/household';
import type {
	CookbookAttribution,
	CookbookImportSummary,
	CookbookRecipe,
	CookbookStructure,
	DietTag,
	RecipeStep,
	RecipeTag,
	WikibooksPage,
	WikibooksSections
} from '$lib/models/recipes';
import type { RecipeDao, RecipeWithIngredientsDao } from '$repositories';

/** The licence the wiki states for its text, from the MediaWiki site info. */
export interface WikibooksLicence {
	text: string;
	url: string;
}

/** Reads recipe pages from the Wikibooks Cookbook through the MediaWiki API. */
export interface IWikibooksClient {
	licence(): Promise<WikibooksLicence>;
	/** The pages of Category:Recipes in the Cookbook namespace, in title order, with wikitext. */
	recipePages(limit: number): AsyncGenerator<WikibooksPage>;
}

/** Turns a parsed page into the app's recipe shape. */
export interface ICookbookStructurer {
	readonly kind: 'model' | 'rules';
	/** The recipe, or an error when the result does not fit the schema. */
	structure(title: string, sections: WikibooksSections): Promise<CookbookStructure>;
}

/** Embeds a recipe's text for similarity search. */
export interface CookbookEmbedder {
	embed(text: string): Promise<number[]>;
}

export interface CookbookImportOptions {
	limit: number;
	/** Called after each page, for a progress line. */
	onPage?: (title: string, outcome: string) => void;
}

/** Imports the Wikibooks Cookbook into the shared catalog. */
export interface ICookbookImportService {
	/**
	 * Imports up to `limit` pages. A page already stored at the same revision is skipped; a new
	 * revision updates it. Refuses to run when the wiki's text licence is not CC BY-SA.
	 */
	import(
		options: CookbookImportOptions
	): Promise<CookbookImportSummary & { importedIds: string[] }>;
}

/** A catalog recipe as the recipe page shows it before the household adopts it. */
export interface CookbookPreview {
	recipe: RecipeWithIngredientsDao;
	steps: RecipeStep[];
	attribution: CookbookAttribution;
}

/** What a household may be offered from the catalog. */
export interface CookbookOffer {
	/** Diet tags every offered recipe must satisfy. */
	dietTags: DietTag[];
	/** Further tags the recipes must have, e.g. ["quick"]. */
	tags?: RecipeTag[];
	/** Lower-case allergens of the household's members; recipes containing one are left out. */
	avoid: string[];
	limit: number;
}

/** The shared cookbook as households use it: offers, previews and adoption. */
export interface ICookbookService {
	/**
	 * Catalog recipes as household-shaped recipes whose id is `cookbook-<uuid>`, for ranking next
	 * to the household's own. Recipes the household already adopted are left out (its copy is in
	 * its recipes); those using more of `wanted` (item keys) come first, the rest in an order
	 * that changes daily.
	 */
	candidates(
		householdId: string,
		offer: CookbookOffer & { wanted: string[]; day: number }
	): Promise<RecipeWithIngredientsDao[]>;
	/** Catalog recipes whose title or ingredients contain the words, as household-shaped recipes. */
	search(
		householdId: string,
		query: string | null,
		offer: CookbookOffer
	): Promise<RecipeWithIngredientsDao[]>;
	/** One catalog recipe, household-shaped, with its steps and attribution, or null. */
	preview(cookbookRecipeId: string): Promise<CookbookPreview | null>;
	get(cookbookRecipeId: string): Promise<CookbookRecipe | null>;
	attribution(cookbookRecipeId: string): Promise<CookbookAttribution | null>;
	/**
	 * The household's copy of the catalog recipe, made on first use with its ingredients, steps,
	 * tags and picture; adopting it again returns the same copy.
	 */
	adopt(actor: Actor, cookbookRecipeId: string): Promise<RecipeDao>;
	/** The household recipe an id names: a household id as it is, a catalog ref adopted. */
	resolve(actor: Actor, recipeId: string): Promise<string>;
}
