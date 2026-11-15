import type { IKitchenService, IPlanService, KitchenPicture } from '$services';
import type { RecipeWithIngredientsDao } from '$repositories';
import type { Actor } from '$lib/models/household';
import { nameFromKey } from '$lib/models/kitchen';
import type {
	AddItemInput,
	ChangeResult,
	HomeItem,
	SetQuantityInput,
	UseItUpIdea,
	UseItUpView
} from '$lib/models/useitup';
import { greetingFor } from '$lib/services/doors';
import { localHour, normalizeItemKey } from '$lib/services/kitchen';
import {
	firstName,
	rankIdeas,
	sameItem,
	spokenName,
	withPerishable,
	type RankStock
} from '$lib/services/tonight';
import { eatFirst, frontNames, JUST_SHOPPED_HOURS, toHomeItem } from '$lib/services/useitup';

const HOUR_MS = 60 * 60 * 1000;
const IDEA_COUNT = 5;

function minutesOf(recipe: RecipeWithIngredientsDao): number | null {
	if (recipe.prepTime === null && recipe.cookTime === null) return null;
	return (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
}

const byName = (a: HomeItem, b: HomeItem) => a.name.localeCompare(b.name);

/** What the Use it up door shows, and what its buttons do. */
export class UseItUpController {
	constructor(
		private kitchenService: IKitchenService,
		private planService: IPlanService
	) {}

	async get(actor: Actor, now: Date, timeZone: string): Promise<UseItUpView> {
		const picture = await this.kitchenService.getPicture(actor.householdId, now, timeZone);
		const stock = this.stock(picture);
		const first = eatFirst(stock, picture.day).map((item) => toHomeItem(item, picture.day));
		const firstKeys = new Set(first.map((item) => item.itemKey));
		const justShopped =
			picture.lastShopDoneAt !== null &&
			now.getTime() - picture.lastShopDoneAt.getTime() <= JUST_SHOPPED_HOURS * HOUR_MS &&
			now.getTime() >= picture.lastShopDoneAt.getTime();

		return {
			greeting: greetingFor(Math.floor(localHour(now, timeZone)), firstName(actor.displayName)),
			question: 'What needs eating *first*?',
			tracks: picture.tracks,
			frontNames: justShopped ? frontNames(first) : null,
			eatFirst: first,
			everything: stock
				.filter((item) => !firstKeys.has(item.itemKey))
				.map((item) => toHomeItem(item, picture.day))
				.sort(byName)
		};
	}

	/** Everything the kitchen holds now, by name, for pages that match recipes to it. */
	async listHome(actor: Actor, now: Date, timeZone: string): Promise<HomeItem[]> {
		const picture = await this.kitchenService.getPicture(actor.householdId, now, timeZone);
		return this.stock(picture)
			.map((item) => toHomeItem(item, picture.day))
			.sort(byName);
	}

	/** Household recipes that use the item, best first. */
	async ideas(actor: Actor, itemKey: string, now: Date, timeZone: string): Promise<UseItUpIdea[]> {
		const key = normalizeItemKey(itemKey);
		const [picture, cookbook] = await Promise.all([
			this.kitchenService.getPicture(actor.householdId, now, timeZone),
			this.planService.getCookbook(actor, now)
		]);
		const stock = this.stock(picture);
		const stockKeys = stock.map((item) => item.itemKey);
		const recipes = cookbook.recipes
			.map((recipe) => ({
				id: recipe.id,
				title: recipe.title,
				source: recipe,
				ingredients: recipe.ingredients
					.filter((ingredient) => !ingredient.optional)
					.map((ingredient) => {
						const ingredientKey = normalizeItemKey(ingredient.name);
						return {
							itemKey: stockKeys.find((k) => sameItem(k, ingredientKey)) ?? ingredientKey,
							quantity: parseFloat(ingredient.quantity) || 0,
							unit: ingredient.unit
						};
					})
			}))
			.filter((recipe) => recipe.ingredients.some((i) => sameItem(i.itemKey, key)));
		const known = new Set(cookbook.cookedOrSaved);
		return rankIdeas(recipes, stock, [], {
			day: picture.day,
			tracksKitchen: picture.tracks,
			known: recipes
				.filter((recipe) => known.has(recipe.id))
				.flatMap((recipe) => recipe.ingredients.map((i) => i.itemKey)),
			limit: IDEA_COUNT
		}).map(({ recipe, uses, missing }) => ({
			recipeId: recipe.id,
			title: recipe.title,
			imageUrl: recipe.source.imageUrl,
			minutes: minutesOf(recipe.source),
			uses: uses.map((k) => spokenName(k, recipe.source.ingredients)),
			missing: missing.map((k) => spokenName(k, recipe.source.ingredients))
		}));
	}

	/** "It's gone" / "Binned it": the item leaves the kitchen. */
	async markGone(
		actor: Actor,
		itemKey: string,
		now: Date,
		timeZone: string
	): Promise<ChangeResult> {
		const name = await this.nameOf(actor, itemKey, now, timeZone);
		const event = await this.kitchenService.correct({
			actor,
			itemKey,
			kind: 'CORRECTED_GONE',
			name,
			at: now
		});
		return {
			message: `${name} gone. If anything planned needed it, it’s on the list.`,
			undoId: event.id
		};
	}

	/** "Still good": the item is there after all, and good until at least tomorrow. */
	async stillGood(
		actor: Actor,
		itemKey: string,
		now: Date,
		timeZone: string
	): Promise<ChangeResult> {
		const name = await this.nameOf(actor, itemKey, now, timeZone);
		const event = await this.kitchenService.correct({
			actor,
			itemKey,
			kind: 'CORRECTED_STILL_GOOD',
			name,
			at: now
		});
		return { message: `${name} is still good. Noted.`, undoId: event.id };
	}

	/** Undo for a correction or an item added by hand: the kitchen is as it was before. */
	async undoCorrection(actor: Actor, undoId: string): Promise<void> {
		await this.kitchenService.undoEvent(actor.householdId, undoId);
	}

	/** "Add something": an item that came into the kitchen without a receipt. */
	async addItem(actor: Actor, input: AddItemInput, now: Date): Promise<ChangeResult> {
		const name = input.name.trim();
		const [event] = await this.kitchenService.recordBought(
			actor,
			[
				{
					name,
					quantity: input.quantity ?? null,
					unit: input.unit?.trim() || null,
					category: input.category ?? null
				}
			],
			now,
			'manual'
		);
		if (!event) throw new Error('Nothing to add');
		return { message: `${name} is in the kitchen.`, undoId: event.id };
	}

	/** "How much is left": the item's total becomes the new amount. */
	async setQuantity(
		actor: Actor,
		input: SetQuantityInput,
		now: Date,
		timeZone: string
	): Promise<ChangeResult> {
		const picture = await this.kitchenService.getPicture(actor.householdId, now, timeZone);
		const item = picture.stock.find((x) => x.itemKey === normalizeItemKey(input.itemKey));
		const name = item?.name ?? nameFromKey(normalizeItemKey(input.itemKey));
		const event = await this.kitchenService.correct({
			actor,
			itemKey: input.itemKey,
			kind: 'CORRECTED_QUANTITY',
			quantity: input.quantity,
			unit: input.unit?.trim() || item?.unit || null,
			name,
			at: now
		});
		return { message: `${name} updated.`, undoId: event.id };
	}

	private stock(picture: KitchenPicture): RankStock[] {
		return withPerishable(picture.stock, picture.lots, picture.day);
	}

	private async nameOf(actor: Actor, itemKey: string, now: Date, timeZone: string) {
		const picture = await this.kitchenService.getPicture(actor.householdId, now, timeZone);
		const key = normalizeItemKey(itemKey);
		return picture.stock.find((item) => item.itemKey === key)?.name ?? nameFromKey(key);
	}
}
