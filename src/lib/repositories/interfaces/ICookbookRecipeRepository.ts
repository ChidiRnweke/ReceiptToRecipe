import type {
	CookbookBundleRowDao,
	CookbookPictureDao,
	CookbookRecipeDao,
	CookbookSampleQuery,
	CookbookSearchQuery,
	NewCookbookRecipeDao
} from '../daos';

/** The shared catalog of imported cookbook recipes. */
export interface ICookbookRecipeRepository {
	findById(id: string): Promise<CookbookRecipeDao | null>;
	findByIds(ids: string[]): Promise<CookbookRecipeDao[]>;
	findByPageId(pageId: number): Promise<CookbookRecipeDao | null>;
	/** Inserts the page's recipe, or replaces the one stored for its page id. */
	upsert(recipe: NewCookbookRecipeDao): Promise<CookbookRecipeDao>;
	updatePicture(id: string, picture: CookbookPictureDao): Promise<void>;
	/**
	 * Recipes without a picture, oldest first. With `standIns`, recipes whose picture is a seed
	 * stand-in (source COMMONS) count as without one.
	 */
	findWithoutPicture(limit: number, standIns: boolean): Promise<CookbookRecipeDao[]>;
	countWithoutPicture(standIns: boolean): Promise<number>;
	/** Recipes that pass the filter, those using more `wanted` items first, then by `seed`. */
	sample(query: CookbookSampleQuery): Promise<CookbookRecipeDao[]>;
	/** Recipes that pass the filter and match the words, or rank closest to the embedding. */
	search(query: CookbookSearchQuery): Promise<CookbookRecipeDao[]>;
	/** Rows with their item keys and embedding, by page id after `afterPageId`, for a bundle. */
	listForBundle(afterPageId: number, limit: number): Promise<CookbookBundleRowDao[]>;
	count(): Promise<number>;
}
