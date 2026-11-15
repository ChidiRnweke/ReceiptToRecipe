import type {
	IMealLogRepository,
	IRecipeRepository,
	ISavedRecipeRepository,
	IUserPreferencesRepository,
	RecipeDao
} from '$repositories';
import type {
	ICulinaryIntelligence,
	IKitchenService,
	IRecipeBookService,
	IStorageService,
	ITasteProfileService,
	KitchenPicture,
	LlmGeneratedRecipe,
	TaggingSummary
} from '$services';
import { hasTags, matchKitchen, stepsFromGenerated } from '$services/recipes';
import type { Actor } from '$lib/models/household';
import {
	FILTER_TAGS,
	MY_RECIPE_TABS,
	type MyRecipeRow,
	type MyRecipes,
	type MyRecipesTab,
	type RecipeCardResult,
	type RecipeTag,
	type SnapKind
} from '$lib/models/recipes';

/** A photo as it arrived from the browser. */
export interface SnapPhoto {
	bytes: Uint8Array;
	name: string;
	mimeType: string;
}

export interface SnappedRecipe extends RecipeCardResult {
	kind: SnapKind;
}

/** How many of the household's recipes "My recipes" reads. */
const HOUSEHOLD_RECIPE_LIMIT = 500;

/** The Recipes door: make one up, snap one, and find your recipes again. */
export class RecipesDoorController {
	constructor(
		private culinaryIntelligence: ICulinaryIntelligence,
		private storageService: IStorageService,
		private kitchenService: IKitchenService,
		private tasteProfileService: ITasteProfileService,
		private recipeBook: IRecipeBookService,
		private userPreferencesRepository: IUserPreferencesRepository,
		private recipeRepository: IRecipeRepository,
		private savedRecipeRepository: ISavedRecipeRepository,
		private mealLogRepository: IMealLogRepository,
		private now: () => Date = () => new Date()
	) {}

	/**
	 * Makes up and saves one recipe for a craving, using what the kitchen holds. Titles already
	 * offered for the same craving are passed on, so "Another one" gives a different dish.
	 */
	async craving(actor: Actor, text: string, previousTitles: string[]): Promise<RecipeCardResult> {
		const [preferences, tasteProfile, picture] = await Promise.all([
			this.userPreferencesRepository.findByUserId(actor.userId),
			this.tasteProfileService.getUserTasteProfile(actor.userId),
			this.kitchenService.getPicture(actor.householdId, this.now(), actor.timeZone)
		]);
		const available = stockNames(picture);

		const generated = await this.culinaryIntelligence.generateFromCraving({
			text,
			available,
			preferences: preferences ?? {},
			tasteProfile,
			excludeTitles: previousTitles,
			servings: preferences?.defaultServings ?? 2
		});
		const recipe = await this.recipeBook.create(actor, { recipe: generated, source: 'GENERATED' });
		return toCard(recipe, generated, available);
	}

	/**
	 * Stores the photo, reads a recipe from it and saves the recipe as SNAPPED. A cookbook page
	 * or a dish keeps the photo as the recipe's picture; a screenshot gets a generated one.
	 */
	async snap(actor: Actor, photo: SnapPhoto): Promise<SnappedRecipe> {
		const [preferences, tasteProfile, picture, upload] = await Promise.all([
			this.userPreferencesRepository.findByUserId(actor.userId),
			this.tasteProfileService.getUserTasteProfile(actor.userId),
			this.kitchenService.getPicture(actor.householdId, this.now(), actor.timeZone),
			this.storageService.upload(photo.bytes, photo.name, photo.mimeType, 'recipes')
		]);

		const { kind, recipe: generated } = await this.culinaryIntelligence
			.recipeFromImage(
				{ bytes: photo.bytes, mimeType: photo.mimeType },
				{
					preferences: preferences ?? {},
					tasteProfile,
					servings: preferences?.defaultServings ?? 2
				}
			)
			.catch(async (error: unknown) => {
				// Nothing refers to the photo when no recipe came out of it.
				await this.storageService.delete(upload.key);
				throw error;
			});

		const recipe = await this.recipeBook.create(actor, {
			recipe: generated,
			source: 'SNAPPED',
			photoUrl: kind === 'screenshot' ? null : upload.url
		});
		return { ...toCard(recipe, generated, stockNames(picture)), kind };
	}

	/**
	 * The rows of one "My recipes" tab, plus the count of every tab.
	 * - made: recipes the household cooked, or the person logged eating, newest first
	 * - saved: the person's saved recipes they can still see, last saved first
	 * - added: recipes the household made up or snapped, newest first
	 * - all: every recipe of the household, newest first
	 * Every tab keeps the recipes that have all of `tags`. Without tags, the household's diets
	 * apply, so a vegetarian household sees vegetarian recipes; `[]` shows everything.
	 */
	async listMine(actor: Actor, tab: MyRecipesTab, tags?: RecipeTag[]): Promise<MyRecipes> {
		const [household, saved, cooked, mealLogs, householdDiets] = await Promise.all([
			this.recipeRepository.findByHouseholdId(actor.householdId, HOUSEHOLD_RECIPE_LIMIT),
			this.savedRecipeRepository.findByUserId(actor.userId),
			this.kitchenService.listCooked(actor.householdId),
			this.mealLogRepository.findByUserId(actor.userId),
			this.tasteProfileService.householdDietTags(actor.householdId)
		]);
		const applied: RecipeTag[] = tags ?? householdDiets;

		const visible = (recipe: RecipeDao) =>
			recipe.isPublic || recipe.householdId === actor.householdId;

		const lastMade = new Map<string, Date>();
		const madeEvents = [
			...cooked.map((event) => ({ recipeId: event.recipeId, at: event.at })),
			...mealLogs.flatMap((log) =>
				log.recipeId ? [{ recipeId: log.recipeId, at: log.consumedAt }] : []
			)
		].sort((a, b) => b.at.getTime() - a.at.getTime());
		for (const event of madeEvents) {
			if (!lastMade.has(event.recipeId)) lastMade.set(event.recipeId, event.at);
		}

		const byId = new Map(household.map((recipe) => [recipe.id, recipe]));
		const elsewhere = [...lastMade.keys()].filter((id) => !byId.has(id));
		for (const recipe of await this.recipeRepository.findByIds(elsewhere)) {
			if (visible(recipe)) byId.set(recipe.id, recipe);
		}

		const lists: Record<MyRecipesTab, MyRecipeRow[]> = {
			made: [...lastMade.entries()].flatMap(([id, at]) => {
				const recipe = byId.get(id);
				return recipe ? [toRow(recipe, at)] : [];
			}),
			saved: saved
				.filter((entry) => entry.recipe && visible(entry.recipe))
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
				.flatMap((entry) => (entry.recipe ? [toRow(entry.recipe, null)] : [])),
			added: household
				.filter((recipe) => recipe.source === 'GENERATED' || recipe.source === 'SNAPPED')
				.map((recipe) => toRow(recipe, null)),
			all: household.map((recipe) => toRow(recipe, null))
		};

		const matching = (rows: MyRecipeRow[]) => rows.filter((row) => hasTags(row.tags, applied));
		const offered = FILTER_TAGS.filter(
			(tag) => applied.includes(tag) || lists[tab].some((row) => row.tags.includes(tag))
		);
		return {
			tab,
			rows: matching(lists[tab]),
			counts: Object.fromEntries(
				MY_RECIPE_TABS.map((key) => [key, matching(lists[key]).length])
			) as Record<MyRecipesTab, number>,
			tags: applied,
			householdDiets,
			offered
		};
	}

	/** Tags the recipes the model has not tagged yet, in the background; see `tagUntagged`. */
	resumeTagging(): Promise<TaggingSummary> {
		return this.recipeBook.queueTagging();
	}
}

/** What the kitchen holds and is still good, by item key; leftovers are not ingredients. */
function stockNames(picture: KitchenPicture): string[] {
	return picture.stock.filter((item) => !item.off && !item.leftoverOf).map((item) => item.itemKey);
}

function totalMinutes(recipe: Pick<RecipeDao, 'prepTime' | 'cookTime'>): number | null {
	const total = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
	return total > 0 ? total : null;
}

function toRow(recipe: RecipeDao, madeAt: Date | null): MyRecipeRow {
	return {
		id: recipe.id,
		title: recipe.title,
		imageUrl: recipe.imageUrl,
		source: recipe.source,
		totalMinutes: totalMinutes(recipe),
		madeAt,
		tags: recipe.tags ?? []
	};
}

function toCard(
	recipe: RecipeDao,
	generated: LlmGeneratedRecipe,
	available: string[]
): RecipeCardResult {
	return {
		id: recipe.id,
		title: recipe.title,
		description: recipe.description,
		imageUrl: recipe.imageUrl,
		source: recipe.source,
		totalMinutes: totalMinutes(recipe),
		steps: stepsFromGenerated(generated),
		...matchKitchen(generated.ingredients, available),
		saved: false
	};
}
