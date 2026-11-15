import type { ListMineInput, MyRecipesTab, RecipeTag } from '$lib/models/recipes';

/**
 * The tags "My recipes" is filtered on. Undefined until the person changes a chip, so the
 * household's diets apply first.
 */
class RecipeFilterState {
	tags = $state<RecipeTag[] | undefined>(undefined);

	/** The `listMine` arguments for one tab with the current tags. */
	input(tab: MyRecipesTab): ListMineInput {
		return this.tags === undefined ? { tab } : { tab, tags: this.tags };
	}

	/** Turns one tag on or off, starting from the tags the list showed. */
	toggle(tag: RecipeTag, shown: RecipeTag[]) {
		this.tags = shown.includes(tag) ? shown.filter((t) => t !== tag) : [...shown, tag];
	}
}

export const recipeFilter = new RecipeFilterState();
