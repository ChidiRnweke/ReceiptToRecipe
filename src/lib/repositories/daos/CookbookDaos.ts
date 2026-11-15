import type {
	CookbookRecipe,
	CookbookStructure,
	CookbookStructurer,
	ImageCredit,
	RecipeImageSource,
	RecipeTag
} from '$lib/models/recipes';

export interface CookbookRecipeDao extends CookbookRecipe {
	/** Whether the row has an embedding for similarity search. */
	embedded: boolean;
}

/** A catalog row with everything a cookbook bundle carries for it. */
export interface CookbookBundleRowDao extends CookbookRecipeDao {
	itemKeys: string[];
	embedding: number[] | null;
}

/** A page's recipe as the importer writes it. */
export interface NewCookbookRecipeDao {
	pageId: number;
	revisionId: number;
	title: string;
	pageTitle: string;
	sourceUrl: string;
	licence: string;
	recipe: CookbookStructure;
	tags: RecipeTag[];
	cuisine: string | null;
	itemKeys: string[];
	structuredBy: CookbookStructurer;
	/**
	 * Null when the embedding call failed; search then falls back to words. Left out, an update
	 * keeps the embedding already stored (a new row has none).
	 */
	embedding?: number[] | null;
}

export interface CookbookPictureDao {
	imageUrl?: string | null;
	imageStatus?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	imageSource?: RecipeImageSource | null;
	imageCredit?: ImageCredit | null;
}

/** Which catalog recipes a household may be offered. */
export interface CookbookFilter {
	/** Every group must be met by at least one of the recipe's tags, e.g. [["vegetarian", "vegan"]]. */
	tagGroups: RecipeTag[][];
	/** Lower-case words no ingredient or title may contain, e.g. a member's allergy "peanut". */
	avoid: string[];
	/** Leave out recipes this household has already adopted; its copy is offered instead. */
	householdId: string | null;
	limit: number;
}

export interface CookbookSampleQuery extends CookbookFilter {
	/** Item keys the household has; recipes that use more of them come first. */
	wanted: string[];
	/** Next, recipes with one of these tags come first, e.g. main dishes for a dinner. */
	preferTags: RecipeTag[];
	/** Orders the rest; the same seed gives the same order. */
	seed: string;
}

export interface CookbookSearchQuery extends CookbookFilter {
	/** Words that the title or an ingredient must contain. */
	text: string | null;
	/** Ranks by similarity to this embedding when given; recipes without one are left out. */
	embedding: number[] | null;
}
