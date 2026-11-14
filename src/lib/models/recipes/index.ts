/**
 * Recipe domain types shared by the browser and the server.
 */
import { z } from 'zod';
import type { TechniqueVerb } from './techniques';

export * from './techniques';
export * from './generated';

export type RecipeSource = 'GENERATED' | 'RAG' | 'USER' | 'SNAPPED';

/** One step of a recipe as the app shows it: a bold verb (when it names a technique) and the rest. */
export interface RecipeStep {
	position: number;
	verb: TechniqueVerb | null;
	/** The step without its verb, e.g. `the onion, 5 min.` for "Sweat the onion, 5 min." */
	text: string;
	minutes: number | null;
}

/** A step read from free text, before it is stored. */
export interface ParsedStep {
	position: number;
	verb: TechniqueVerb | null;
	text: string;
}

/** What a snapped photo turned out to show. */
export type SnapKind = 'page' | 'screenshot' | 'dish';

export const MY_RECIPE_TABS = ['made', 'saved', 'added', 'all'] as const;
export type MyRecipesTab = (typeof MY_RECIPE_TABS)[number];

/** One row of "My recipes". */
export interface MyRecipeRow {
	id: string;
	title: string;
	imageUrl: string | null;
	source: RecipeSource;
	/** Prep plus cook time, when the recipe gives one. */
	totalMinutes: number | null;
	/** When the household last cooked it; set on the Made tab only. */
	madeAt: Date | null;
}

export interface MyRecipes {
	tab: MyRecipesTab;
	rows: MyRecipeRow[];
	counts: Record<MyRecipesTab, number>;
}

/** A freshly made-up or snapped recipe, with how it fits what is in the kitchen. */
export interface RecipeCardResult {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	source: RecipeSource;
	totalMinutes: number | null;
	steps: RecipeStep[];
	/** Ingredients the kitchen already holds. */
	uses: string[];
	/** Ingredients to buy. Common staples such as salt and oil are left out. */
	need: string[];
	saved: boolean;
}

export const SNAP_MAX_BYTES = 10 * 1024 * 1024;

export const listMineInput = z.enum(MY_RECIPE_TABS);

export const cravingInput = z.object({
	text: z.string().trim().min(1, 'Say what you fancy').max(200),
	previousTitles: z.array(z.string().trim().min(1).max(200)).max(10).default([])
});
export type CravingInput = z.infer<typeof cravingInput>;

export const toggleSaveInput = z.object({
	recipeId: z.uuid(),
	saved: z.boolean()
});

export const snapRecipeInput = z.object({
	photo: z
		.instanceof(File, { message: 'Choose a photo' })
		.refine((file) => file.size > 0, 'Choose a photo')
		.refine((file) => file.type.startsWith('image/'), 'That file is not a photo')
		.refine((file) => file.size <= SNAP_MAX_BYTES, 'The photo must be smaller than 10 MB')
});
