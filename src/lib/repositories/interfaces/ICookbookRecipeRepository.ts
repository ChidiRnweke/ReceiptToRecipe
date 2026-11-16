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
	/** Writes the picture fields; `pictureStyle` goes into the recipe, the rest into columns. */
	updatePicture(id: string, picture: CookbookPictureDao): Promise<void>;
	/** Keeps the scene caption a picture is made from in the recipe, as `pictureCaption`. */
	updatePictureCaption(id: string, caption: string): Promise<void>;
	/**
	 * Recipes without a picture, oldest first. With `standIns`, recipes whose picture is a seed
	 * stand-in (source COMMONS) count as without one.
	 */
	findWithoutPicture(limit: number, standIns: boolean): Promise<CookbookRecipeDao[]>;
	countWithoutPicture(standIns: boolean): Promise<number>;
	/**
	 * Recipes without a picture or whose picture is of an older house style than `style`,
	 * oldest first. A regenerated picture records its style, so a stopped run continues.
	 */
	findWithOlderPicture(limit: number, style: number): Promise<CookbookRecipeDao[]>;
	countWithOlderPicture(style: number): Promise<number>;
	/** Recipes that pass the filter, those using more `wanted` items first, then by `seed`. */
	sample(query: CookbookSampleQuery): Promise<CookbookRecipeDao[]>;
	/** Recipes that pass the filter and match the words, or rank closest to the embedding. */
	search(query: CookbookSearchQuery): Promise<CookbookRecipeDao[]>;
	/** Rows with their item keys and embedding, by page id after `afterPageId`, for a bundle. */
	listForBundle(afterPageId: number, limit: number): Promise<CookbookBundleRowDao[]>;
	count(): Promise<number>;
}
