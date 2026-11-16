/**
 * The shared cookbook: recipes imported from the Wikibooks Cookbook, one catalog for every
 * household. A household uses a catalog recipe through its own copy (see `adopt`), so cooking,
 * editing and "Made" work on household recipes only.
 */
import { z } from 'zod';
import { recipeTagSchema, type RecipeTag } from './tags';
import { TECHNIQUE_VERBS, type TechniqueVerb } from './techniques';
import type { ImageCredit, RecipeImageSource } from './picture';

/** Wikibooks text is licensed CC BY-SA 4.0; an adapted recipe keeps the licence and a link. */
export const COOKBOOK_LICENCE = 'CC BY-SA 4.0';
export const COOKBOOK_LICENCE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
export const WIKIBOOKS_BASE_URL = 'https://en.wikibooks.org';

/** How the catalog names a page's recipe in ids that also carry household recipe ids. */
export const COOKBOOK_REF_PREFIX = 'cookbook-';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id of a catalog recipe wherever a recipe id goes: `cookbook-<uuid>`. */
export function cookbookRef(cookbookRecipeId: string): string {
	return `${COOKBOOK_REF_PREFIX}${cookbookRecipeId}`;
}

/** The catalog id in a `cookbook-<uuid>` ref, or null for any other id. */
export function cookbookIdOf(recipeId: string): string | null {
	if (!recipeId.startsWith(COOKBOOK_REF_PREFIX)) return null;
	const id = recipeId.slice(COOKBOOK_REF_PREFIX.length);
	return UUID.test(id) ? id : null;
}

/** A household recipe id (a uuid) or a catalog recipe's `cookbook-<uuid>`. */
export const recipeRefSchema = z.union([
	z.uuid(),
	z.string().refine((value) => cookbookIdOf(value) !== null, 'Not a recipe id')
]);

/** True for a household recipe id or a catalog ref. */
export function isRecipeRef(value: string): boolean {
	return recipeRefSchema.safeParse(value).success;
}

/** One ingredient of a structured catalog recipe. */
export const cookbookIngredientSchema = z.object({
	name: z.string().trim().min(1).max(120),
	/** 0 when the page gives no amount, as in "salt to taste". */
	quantity: z.number().nonnegative().max(100_000),
	/** Empty when the amount is a count, as in "2 eggs". */
	unit: z.string().trim().max(30),
	optional: z.boolean(),
	notes: z.string().trim().max(200).nullable()
});

/** One step: a vocabulary verb when the step starts with one, and the rest. */
export const cookbookStepSchema = z.object({
	verb: z.enum(TECHNIQUE_VERBS).nullable(),
	text: z.string().trim().min(1).max(1000),
	minutes: z
		.number()
		.int()
		.nonnegative()
		.max(24 * 60)
		.nullable()
});

/**
 * A catalog recipe in the app's recipe shape, as the structurer (model or rules) returns it. A
 * result that does not parse is not imported.
 */
export const cookbookStructureSchema = z.object({
	title: z.string().trim().min(1).max(160),
	description: z.string().trim().max(600),
	servings: z.number().int().min(1).max(48),
	prepTime: z
		.number()
		.int()
		.nonnegative()
		.max(24 * 60)
		.nullable(),
	cookTime: z
		.number()
		.int()
		.nonnegative()
		.max(7 * 24 * 60)
		.nullable(),
	cuisine: z.string().trim().max(60).nullable(),
	ingredients: z.array(cookbookIngredientSchema).min(1).max(80),
	steps: z.array(cookbookStepSchema).min(1).max(80),
	tags: z.array(recipeTagSchema).max(15),
	/** The scene caption the recipe's picture is generated from, once one is written. */
	pictureCaption: z.string().trim().min(1).max(1000).optional(),
	/** The house-style version of the stored picture; absent for older pictures. */
	pictureStyle: z.number().int().nonnegative().optional(),
	/** How often the picture was made again after a judge turned it down; absent means never. */
	pictureAttempt: z.number().int().nonnegative().optional()
});
export type CookbookStructure = z.infer<typeof cookbookStructureSchema>;
export type CookbookIngredient = z.infer<typeof cookbookIngredientSchema>;

/** Which structurer turned the page into a recipe. */
export type CookbookStructurer = 'model' | 'rules';

/** One recipe of the shared catalog. */
export interface CookbookRecipe {
	id: string;
	pageId: number;
	revisionId: number;
	/** The page title without the `Cookbook:` namespace, e.g. "Adobo Chicken (Philippine)". */
	title: string;
	/** The full page title, e.g. "Cookbook:Adobo Chicken (Philippine)". */
	pageTitle: string;
	sourceUrl: string;
	licence: string;
	recipe: CookbookStructure;
	tags: RecipeTag[];
	cuisine: string | null;
	structuredBy: CookbookStructurer;
	imageUrl: string | null;
	imageStatus: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	imageSource: RecipeImageSource | null;
	imageCredit: ImageCredit | null;
	importedAt: Date;
	updatedAt: Date;
}

/** The line under an adapted recipe, with links to the page and its authors. */
export interface CookbookAttribution {
	title: string;
	pageUrl: string;
	historyUrl: string;
	licence: string;
	licenceUrl: string;
}

/** The page and history URLs of a Wikibooks page title. */
export function wikibooksUrls(pageTitle: string): { pageUrl: string; historyUrl: string } {
	const path = encodeURIComponent(pageTitle.replace(/ /g, '_'))
		.replace(/%3A/gi, ':')
		.replace(/%2F/gi, '/');
	return {
		pageUrl: `${WIKIBOOKS_BASE_URL}/wiki/${path}`,
		historyUrl: `${WIKIBOOKS_BASE_URL}/w/index.php?title=${path}&action=history`
	};
}

export function attributionOf(
	recipe: Pick<CookbookRecipe, 'title' | 'pageTitle' | 'licence'>
): CookbookAttribution {
	return {
		title: recipe.title,
		...wikibooksUrls(recipe.pageTitle),
		licence: recipe.licence,
		licenceUrl: COOKBOOK_LICENCE_URL
	};
}

/** A page as the MediaWiki API returns it. */
export interface WikibooksPage {
	pageId: number;
	revisionId: number;
	title: string;
	wikitext: string;
}

/** Why a page was not imported. */
export const COOKBOOK_SKIP_REASONS = [
	'redirect',
	'no-ingredients',
	'no-amounts',
	'no-steps',
	'structure-invalid',
	'unchanged'
] as const;
export type CookbookSkipReason = (typeof COOKBOOK_SKIP_REASONS)[number];

/** The sections of a recipe page, as plain text lines. */
export interface WikibooksSections {
	/** Ingredient lines, without bullets or markup. */
	ingredients: string[];
	/** Procedure lines, without numbers or markup. */
	procedure: string[];
	/** The lead paragraph, plain text, or empty. */
	description: string;
	/** From the recipe summary box, as written, e.g. "4" or "8–10". */
	servings: string | null;
	/** From the recipe summary box, e.g. "Prep: 20 minutes Baking: 60 minutes". */
	time: string | null;
	/** From the summary's cuisine or category, e.g. "Filipino". */
	cuisine: string | null;
	/** The page's categories, e.g. "Vegetarian recipes". */
	categories: string[];
}

export type ParsedWikibooksRecipe =
	| { ok: true; sections: WikibooksSections }
	| {
			ok: false;
			reason: Extract<
				CookbookSkipReason,
				'redirect' | 'no-ingredients' | 'no-amounts' | 'no-steps'
			>;
	  };

/** What one import run did. */
export interface CookbookImportSummary {
	seen: number;
	imported: number;
	updated: number;
	skipped: Partial<Record<CookbookSkipReason, number>>;
	/** Pages imported without an embedding, because the embedding call failed. */
	unembedded: number;
	/** The pages skipped, with why, for the log. */
	skips: { title: string; reason: CookbookSkipReason; detail?: string }[];
}

/** A catalog recipe as a card on the Recipes door. */
export interface CookbookCard {
	/** `cookbook-<uuid>`; opening, saving or planning it works with this id. */
	id: string;
	title: string;
	imageUrl: string | null;
	totalMinutes: number | null;
	tags: RecipeTag[];
	cuisine: string | null;
}

/** A step as stored in the catalog recipe, with the verb from the vocabulary. */
export interface CookbookStepView {
	verb: TechniqueVerb | null;
	text: string;
	minutes: number | null;
}

/** The format version of a cookbook bundle; a loader refuses other versions. */
export const COOKBOOK_BUNDLE_FORMAT = 1;

/** The licence of FLUX 3 Image Klein's pictures, which a bundle's pictures carry. */
export const FLUX_PICTURE_LICENCE = 'FLUX Kommunity License';

/** One catalog recipe in a bundle's `catalog.jsonl`. */
export interface CookbookBundleLine {
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
	embedding: number[] | null;
	/** The picture under `pictures/`, or null when the recipe had none. */
	picture: { file: string; source: RecipeImageSource; credit: ImageCredit | null } | null;
}

/** A bundle's `manifest.json`. */
export interface CookbookBundleManifest {
	format: typeof COOKBOOK_BUNDLE_FORMAT;
	createdAt: string;
	recipes: number;
	pictures: number;
	embedded: number;
	/** The models the catalog was made with, e.g. `{ text: "...", embedding: "...", pictures: "..." }`. */
	models: Record<string, string>;
	licences: { text: string; pictures: string };
	/** SHA-256 of `catalog.jsonl`, hex. */
	catalogSha256: string;
}

/** What loading a bundle did. */
export interface CookbookBundleLoadSummary {
	recipes: number;
	inserted: number;
	updated: number;
	unchanged: number;
	pictures: number;
}
