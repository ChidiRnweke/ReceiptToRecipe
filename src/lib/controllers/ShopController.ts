import type {
	Cookbook,
	IHabitService,
	IKitchenService,
	IPlanService,
	IShopService,
	KitchenPicture,
	NewManualItem
} from '$services';
import type {
	PlannedMealDao,
	ReceiptDao,
	ReceiptListItemDao,
	ReceiptWithItemsDao
} from '$repositories';
import type { Actor } from '$lib/models/household';
import { normalizeItemKey, type Habits } from '$lib/models/kitchen';
import { MEAL_HOUR } from '$lib/models/plan';
import type {
	CameHomeView,
	ConfirmResult,
	GotEverythingResult,
	HeldItemView,
	IdeaIngredient,
	ListItem,
	PurchaseUndo,
	ReceiptResult,
	RemovedItem,
	RestorableItem,
	ShopGroupView,
	ShopIdeaView,
	ShopItemView,
	ShopList,
	ShopMeal,
	ShopView
} from '$lib/models/shop';
import { greetingFor } from '$lib/services/doors';
import {
	convertUnit,
	dayNumber,
	localHour,
	toBaseUnit,
	weekdayOf,
	weekdayOfDay
} from '$lib/services/kitchen';
import { comingStretch, hasDinner, unplannedDinners } from '$lib/services/plan';
import {
	buildShopNeeds,
	cameHomeMessage,
	dishWhen,
	gotEverythingMessage,
	ideaList,
	matchReceiptToList,
	mayHaveAtHome,
	reconcileList,
	shopTitle,
	shortDay
} from '$lib/services/shop';
import {
	containsItem,
	firstName,
	formatAmount,
	rankIdeas,
	sameItem,
	STAPLES,
	weekdayName,
	withPerishable
} from '$lib/services/tonight';

/** The shop rules read the plan this many days ahead: two shops and the days after them. */
const PLAN_AHEAD_DAYS = 21;
const IDEA_COUNT = 4;
/** Dinners left unplanned in the coming stretch before the list asks to plan first. */
const PLAN_FIRST_GAPS = 3;

/**
 * The receipt flow the Shop door uses. `ReceiptController` provides it: the upload, the OCR job
 * and its kitchen hook stay in one place.
 */
export interface ReceiptIntake {
	uploadReceipt(input: {
		actor: Actor;
		file: File;
		listSnapshot?: ReceiptListItemDao[];
	}): Promise<ReceiptDao>;
	getReceipt(receiptId: string, actor: Actor): Promise<ReceiptWithItemsDao | null>;
}

/** A planned meal with its recipe, as the shop rules and the page see it. */
interface ShopContext {
	today: number;
	meals: PlannedMealDao[];
	shopMeals: ShopMeal[];
	cookbook: Cookbook;
	picture: KitchenPicture;
	habits: Habits;
}

const capitalize = (name: string) => (name ? name[0].toUpperCase() + name.slice(1) : name);

function amountOf(quantity: number | null, unit: string | null): string {
	return quantity === null ? '' : formatAmount(quantity, unit ?? '');
}

function keyOf(item: ListItem): string {
	return item.mergeKey ?? normalizeItemKey(item.name);
}

function restorable(item: ListItem): RestorableItem {
	return {
		name: item.name,
		source: item.source,
		mergeKey: item.mergeKey,
		quantity: item.quantity,
		unit: item.unit,
		checked: item.checked,
		heldUntil: item.heldUntil?.toISOString() ?? null,
		forPlannedMealIds: item.forPlannedMealIds
	};
}

/** What "Got everything" keeps on its SHOP_DONE, to undo it. */
interface GotEverythingUndo {
	items: RestorableItem[];
	purchases: PurchaseUndo[];
}

/** The items the shop is for: everything not held back for a later shop. */
const openItems = (list: ShopList) => list.items.filter((item) => item.heldUntil === null);

/**
 * What the Shop door shows, and what its buttons do.
 *
 * Who records a receipt in the kitchen: the receipt's OCR job (`ReceiptController`) records a
 * BOUGHT per line and the SHOP_DONE with method RECEIPT, for every receipt, as soon as the lines
 * are read. It runs whether or not anyone confirms, and for receipts uploaded outside the Shop
 * door too. "Looks right" (`confirmWhatCameHome`) therefore writes no kitchen events: it only
 * settles the list against the receipt, so the same purchase is never recorded twice.
 */
export class ShopController {
	constructor(
		private shopService: IShopService,
		private planService: IPlanService,
		private kitchenService: IKitchenService,
		private habitService: IHabitService,
		private receipts: ReceiptIntake
	) {}

	/** Syncs the list from the plan, then returns it grouped by dish. */
	async getShop(actor: Actor, now: Date, timeZone: string): Promise<ShopView> {
		const ctx = await this.load(actor, now, timeZone);
		const needs = buildShopNeeds(ctx.picture.lots, ctx.shopMeals, ctx.habits, now, timeZone, {
			skip: this.assumedHome(ctx)
		});
		let list = await this.shopService.getList(actor);
		const plan = reconcileList(list.items, needs);
		if (plan.create.length || plan.update.length || plan.remove.length) {
			await this.shopService.applyPlan(list, plan);
			list = await this.shopService.getList(actor);
		}

		const mealById = new Map(ctx.shopMeals.map((meal) => [meal.id, meal]));
		const open = openItems(list);
		const groups = this.groups(open, mealById, ctx.today);
		const grouped = new Set(groups.flatMap((group) => group.items.map((item) => item.id)));
		const usuals = open.filter((item) => item.source === 'USUAL').map((i) => this.item(i, []));
		const manual = open
			.filter((item) => !grouped.has(item.id) && item.source !== 'USUAL')
			.map((item) => ({
				...this.item(item, []),
				atHome: item.source === 'MANUAL' && mayHaveAtHome(keyOf(item), ctx.picture.stock)
			}));
		const count = grouped.size + usuals.length + manual.length;

		const mode = this.ideasMode(ctx) ? 'ideas' : 'list';
		const gaps = unplannedDinners(ctx.meals, comingStretch(ctx.habits, now, timeZone), timeZone);
		const planFirst = gaps.length >= PLAN_FIRST_GAPS && ctx.habits.planningStyle !== 'none';
		const empty =
			mode === 'list' && !groups.length && (planFirst || count === 0)
				? planFirst
					? 'plan-first'
					: 'nothing-needed'
				: null;

		return {
			greeting: greetingFor(Math.floor(localHour(now, timeZone)), firstName(actor.displayName)),
			question: 'What do we *need*?',
			title: shopTitle(needs.nextShop?.day ?? null),
			count,
			mode,
			groups,
			usuals,
			manual,
			held: this.held(list, mealById, needs.afterShop?.day ?? null, timeZone),
			empty,
			doneHabit: ctx.habits.doneHabitByMember[actor.memberId] ?? 'RECEIPT',
			hasList: count > 0,
			ideas: mode === 'ideas' ? this.ideas(ctx) : [],
			tracks: ctx.picture.tracks
		};
	}

	async toggleItem(actor: Actor, itemId: string, checked: boolean): Promise<void> {
		await this.shopService.setChecked(actor, itemId, checked);
	}

	async addItem(actor: Actor, item: NewManualItem): Promise<void> {
		await this.shopService.addManual(actor, item);
	}

	/** Removes an item added by hand, and returns it so the page can offer to put it back. */
	async removeItem(actor: Actor, itemId: string): Promise<RemovedItem> {
		const item = await this.shopService.removeManual(actor, itemId);
		return { name: item.name, quantity: item.quantity, unit: item.unit, checked: item.checked };
	}

	/** Undo for `removeItem`: the item is back on the list, as added by hand. */
	async restoreItem(actor: Actor, item: RemovedItem): Promise<void> {
		await this.shopService.restoreItems(actor, [
			{
				...item,
				name: item.name.trim(),
				source: 'MANUAL',
				mergeKey: normalizeItemKey(item.name),
				heldUntil: null,
				forPlannedMealIds: []
			}
		]);
	}

	/**
	 * "Got everything": the ticked items came home, or the whole list when nothing is ticked.
	 * They become BOUGHT events and a SHOP_DONE with method TICK, count in the purchase history,
	 * and leave the list. Held-back items stay. A household choosing dinners from ideas also gets
	 * those dinners planned on the next free days.
	 */
	async gotEverything(
		actor: Actor,
		now: Date,
		timeZone: string,
		ideaIds: string[] = []
	): Promise<GotEverythingResult> {
		const list = await this.shopService.getList(actor);
		const open = openItems(list);
		const ticked = open.filter((item) => item.checked);
		const fromList = ticked.length ? ticked : open;

		let ideaLines: { name: string; quantity: number | null; unit: string | null }[] = [];
		let tracks = true;
		if (ideaIds.length) {
			const ctx = await this.load(actor, now, timeZone);
			tracks = ctx.picture.tracks;
			ideaLines = ideaList(this.ideas(ctx), ideaIds);
			await this.planIdeas(actor, ctx, ideaIds, timeZone);
		}

		const bought = [...fromList, ...ideaLines];
		let undoId: string | null = null;
		if (bought.length) {
			const purchases = await this.shopService.recordPurchases(actor, bought, now);
			// Dinners planned from ideas are not taken back, so that shop cannot be undone.
			const undo: GotEverythingUndo | null = ideaIds.length
				? null
				: { items: fromList.map(restorable), purchases };
			const events = await this.kitchenService.recordShopDone({
				author: actor,
				method: 'TICK',
				items: bought.map((item) => ({
					name: item.name,
					quantity: item.quantity,
					unit: item.unit
				})),
				at: now,
				details: { shoppingListId: list.id, ...(undo ? { undo } : {}) }
			});
			await this.shopService.removeItems(
				actor,
				fromList.map((item) => item.id)
			);
			const shopId = events.find((event) => event.kind === 'SHOP_DONE')?.payload?.shopId;
			undoId = undo && typeof shopId === 'string' ? shopId : null;
		}
		return {
			recorded: bought.length,
			message: gotEverythingMessage(tracks, ideaIds.length > 0),
			undoId
		};
	}

	/**
	 * Undo for "Got everything": the items are back on the list as they were, the purchase
	 * history counts as before, and the kitchen forgets the shop and what it bought.
	 */
	async undoGotEverything(actor: Actor, undoId: string): Promise<void> {
		const shop = await this.kitchenService.findShop(actor.householdId, undoId);
		const undo = shop?.method === 'TICK' ? (shop.payload?.undo as GotEverythingUndo) : undefined;
		if (!undo) throw new Error('Shop not found');
		await this.shopService.restoreItems(actor, undo.items);
		await this.shopService.undoPurchases(actor, undo.purchases);
		await this.kitchenService.forgetShop(actor.householdId, undoId);
	}

	/**
	 * Uploads the photo and starts its OCR job. The open list is kept with the receipt as it is
	 * now, so a sync while the receipt is read (which drops what the receipt already put in the
	 * kitchen) cannot change what the receipt is matched against.
	 */
	async snapReceipt(actor: Actor, file: File): Promise<{ receiptId: string }> {
		const list = await this.shopService.getList(actor);
		const listSnapshot = openItems(list).map((item) => ({
			id: item.id,
			name: item.name,
			itemKey: keyOf(item)
		}));
		const receipt = await this.receipts.uploadReceipt({ actor, file, listSnapshot });
		return { receiptId: receipt.id };
	}

	/** The receipt's status, and once it is read, its lines matched to the list. */
	async getReceiptResult(
		actor: Actor,
		receiptId: string,
		timeZone: string
	): Promise<ReceiptResult> {
		const receipt = await this.receiptFor(actor, receiptId);
		if (receipt.status !== 'DONE') {
			return { status: receipt.status, error: receipt.errorMessage, slip: null, cameHome: null };
		}
		const list = await this.shopService.getList(actor);
		const { match, open } = this.match(receipt, list);
		const cameHome: CameHomeView = {
			fromList: open.length > 0,
			matched: match.matched.length,
			extras: match.extras.map((line) => ({
				name: capitalize(line.name),
				amount: amountOf(line.quantity, line.unit)
			})),
			missing: match.missing.map((item) => ({ name: capitalize(item.name) }))
		};
		return { status: 'DONE', error: null, slip: this.slip(receipt, timeZone), cameHome };
	}

	/**
	 * "Looks right": what the receipt matched leaves the list, and what it did not stays on it,
	 * unticked. The OCR job already put every line in the kitchen (see the class comment).
	 */
	async confirmWhatCameHome(actor: Actor, receiptId: string): Promise<ConfirmResult> {
		const receipt = await this.receiptFor(actor, receiptId);
		if (receipt.status !== 'DONE') throw new Error('The receipt is still being read');
		const list = await this.shopService.getList(actor);
		const { match } = this.match(receipt, list);
		// A sync since the photo may have removed items the receipt was matched against.
		const live = new Map(list.items.map((item) => [item.id, item]));
		await this.shopService.removeItems(
			actor,
			match.matched.map(({ item }) => item.id).filter((id) => live.has(id))
		);
		await this.shopService.untick(
			actor,
			match.missing.filter((item) => live.get(item.id)?.checked).map((item) => item.id)
		);
		return {
			message: cameHomeMessage(
				receipt.items.length,
				match.missing.map((item) => item.name)
			)
		};
	}

	private async receiptFor(actor: Actor, receiptId: string): Promise<ReceiptWithItemsDao> {
		const receipt = await this.receipts.getReceipt(receiptId, actor);
		if (!receipt) throw new Error('Receipt not found');
		return receipt;
	}

	/**
	 * Matches the receipt to the list as it was when the receipt was snapped, or to the live list
	 * for a receipt uploaded elsewhere.
	 */
	private match(receipt: ReceiptWithItemsDao, list: ShopList) {
		const open: ReceiptListItemDao[] =
			receipt.listSnapshot ??
			openItems(list).map((item) => ({ id: item.id, name: item.name, itemKey: keyOf(item) }));
		const lines = receipt.items.map((line) => {
			const quantity = parseFloat(line.quantity);
			return {
				id: line.id,
				itemKey: normalizeItemKey(line.normalizedName),
				name: line.normalizedName,
				quantity: Number.isFinite(quantity) ? quantity : null,
				unit: line.unit
			};
		});
		return { match: matchReceiptToList(lines, open), open };
	}

	private slip(receipt: ReceiptWithItemsDao, timeZone: string) {
		const at = receipt.purchaseDate ?? receipt.createdAt;
		const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short' })
			.format(at)
			.toUpperCase();
		const date = new Intl.DateTimeFormat('en-GB', {
			timeZone,
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		})
			.format(at)
			.replace(',', '');
		const lines = receipt.items.map((line) => ({
			name: line.rawName.toUpperCase(),
			qty: amountOf(parseFloat(line.quantity) || 1, line.unit) || '1',
			price: parseFloat(line.price ?? '') || 0
		}));
		const total = parseFloat(receipt.totalAmount ?? '');
		return {
			store: receipt.storeName ?? 'Supermarket',
			when: `${day} ${date}`,
			lines,
			total: Number.isFinite(total) ? total : lines.reduce((sum, line) => sum + line.price, 0),
			currency: receipt.currency ?? 'EUR'
		};
	}

	private async load(actor: Actor, now: Date, timeZone: string): Promise<ShopContext> {
		const today = dayNumber(now, timeZone);
		const [meals, cookbook, picture, habits] = await Promise.all([
			this.planService.listMeals(actor.householdId, today, today + PLAN_AHEAD_DAYS, timeZone),
			this.planService.getCookbook(actor, now),
			this.kitchenService.getPicture(actor.householdId, now, timeZone),
			this.habitService.getHabits(actor.householdId, now, timeZone)
		]);
		const stockKeys = picture.stock.map((item) => item.itemKey);
		const recipes = new Map(cookbook.recipes.map((recipe) => [recipe.id, recipe]));
		const shopMeals: ShopMeal[] = [];
		for (const meal of meals) {
			const recipe = meal.recipeId ? recipes.get(meal.recipeId) : undefined;
			if (!recipe || meal.status !== 'PLANNED') continue;
			const factor = (meal.servings ?? recipe.servings) / (recipe.servings || 1);
			shopMeals.push({
				id: meal.id,
				title: recipe.title,
				imageUrl: recipe.imageUrl,
				day: dayNumber(meal.plannedDate, timeZone),
				mealType: meal.mealType,
				ingredients: recipe.ingredients
					.filter((ingredient) => !ingredient.optional)
					.map((ingredient) => {
						const key = normalizeItemKey(ingredient.name);
						return {
							itemKey: stockKeys.find((stockKey) => sameItem(stockKey, key)) ?? key,
							name: capitalize(ingredient.name.trim()),
							quantity: (parseFloat(ingredient.quantity) || 0) * factor,
							unit: ingredient.unit
						};
					})
			});
		}
		return { today, meals, shopMeals, cookbook, picture, habits };
	}

	/** A household that does not track its kitchen is assumed to have the staples. */
	private assumedHome(ctx: ShopContext): ((itemKey: string) => boolean) | undefined {
		if (ctx.picture.tracks) return undefined;
		return (itemKey) => STAPLES.some((staple) => containsItem(itemKey, staple));
	}

	/** A household that does not plan, with nothing planned, picks dinners from ideas. */
	private ideasMode(ctx: ShopContext): boolean {
		return (
			ctx.habits.planningStyle === 'none' && !ctx.meals.some((meal) => meal.status === 'PLANNED')
		);
	}

	private groups(
		open: ListItem[],
		mealById: Map<string, ShopMeal>,
		today: number
	): ShopGroupView[] {
		const byMeal = new Map<string, ShopGroupView>();
		const order = (meal: ShopMeal) => meal.day * 24 + MEAL_HOUR[meal.mealType];
		for (const item of open) {
			if (item.source !== 'PLAN') continue;
			const meal = mealById.get(item.forPlannedMealIds[0] ?? '');
			if (!meal) continue;
			let group = byMeal.get(meal.id);
			if (!group) {
				group = {
					mealId: meal.id,
					title: meal.title,
					imageUrl: meal.imageUrl,
					when: dishWhen(meal.day, today, meal.prep),
					items: []
				};
				byMeal.set(meal.id, group);
			}
			const also = item.forPlannedMealIds
				.slice(1)
				.map((id) => mealById.get(id))
				.filter((other): other is ShopMeal => !!other && other.day !== meal.day)
				.map((other) => shortDay(other.day));
			group.items.push(this.item(item, [...new Set(also)]));
		}
		return [...byMeal.values()].sort(
			(a, b) =>
				order(mealById.get(a.mealId) as ShopMeal) - order(mealById.get(b.mealId) as ShopMeal)
		);
	}

	private item(item: ListItem, also: string[]): ShopItemView {
		return {
			id: item.id,
			name: capitalize(item.name),
			amount: amountOf(item.quantity, item.unit),
			checked: item.checked,
			also,
			source: item.source,
			atHome: false
		};
	}

	private held(
		list: ShopList,
		mealById: Map<string, ShopMeal>,
		afterShopDay: number | null,
		timeZone: string
	): ShopView['held'] {
		const held = list.items.filter((item) => item.heldUntil !== null && item.source === 'PLAN');
		if (!held.length) return null;
		const weekday = weekdayName(
			afterShopDay !== null
				? weekdayOfDay(afterShopDay)
				: weekdayOf(held[0].heldUntil as Date, timeZone)
		);
		const items: HeldItemView[] = held.map((item) => ({
			name: capitalize(item.name),
			days: [
				...new Set(
					item.forPlannedMealIds
						.map((id) => mealById.get(id))
						.filter((meal): meal is ShopMeal => !!meal)
						.map((meal) => shortDay(meal.day))
				)
			],
			amount: amountOf(item.quantity, item.unit)
		}));
		return { shop: `${weekday}’s shop`, items };
	}

	/** Four ranked dinners, each with what it would add to the list. */
	private ideas(ctx: ShopContext): ShopIdeaView[] {
		const stock = withPerishable(ctx.picture.stock, ctx.picture.lots, ctx.today);
		const stockKeys = stock.map((item) => item.itemKey);
		const recipes = ctx.cookbook.recipes.map((recipe) => ({
			id: recipe.id,
			title: recipe.title,
			source: recipe,
			ingredients: recipe.ingredients
				.filter((ingredient) => !ingredient.optional)
				.map((ingredient) => {
					const key = normalizeItemKey(ingredient.name);
					return {
						itemKey: stockKeys.find((stockKey) => sameItem(stockKey, key)) ?? key,
						name: capitalize(ingredient.name.trim()),
						quantity: parseFloat(ingredient.quantity) || 0,
						unit: ingredient.unit
					};
				})
		}));
		const known = new Set(ctx.cookbook.cookedOrSaved);
		const knownKeys = recipes
			.filter((recipe) => known.has(recipe.id))
			.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.itemKey));
		const skip = (itemKey: string) =>
			!ctx.picture.tracks &&
			(STAPLES.some((staple) => containsItem(itemKey, staple)) ||
				knownKeys.some((key) => sameItem(key, itemKey)));

		return rankIdeas(recipes, stock, [], {
			day: ctx.today,
			tracksKitchen: ctx.picture.tracks,
			known: knownKeys,
			limit: IDEA_COUNT
		}).map(({ recipe, uses, missing }) => ({
			recipeId: recipe.id,
			title: recipe.title,
			imageUrl: recipe.source.imageUrl,
			uses,
			missing,
			ingredients: recipe.ingredients
				.filter((ingredient) => !skip(ingredient.itemKey))
				.map((ingredient): IdeaIngredient => {
					const base = toBaseUnit(ingredient.quantity, ingredient.unit) ?? {
						quantity: ingredient.quantity,
						unit: ingredient.unit
					};
					const held = stock.find((x) => !x.off && sameItem(x.itemKey, ingredient.itemKey));
					const have = held ? (convertUnit(held.quantity, held.unit, base.unit) ?? 0) : 0;
					return { ...ingredient, quantity: base.quantity, unit: base.unit, have };
				})
		}));
	}

	/** Plans each chosen idea as a dinner on the next day from today without one. */
	private async planIdeas(
		actor: Actor,
		ctx: ShopContext,
		recipeIds: string[],
		timeZone: string
	): Promise<void> {
		const taken = [...ctx.meals];
		let day = ctx.today;
		for (const recipeId of recipeIds) {
			if (!ctx.cookbook.recipes.some((recipe) => recipe.id === recipeId)) {
				throw new Error('Recipe not found');
			}
			while (hasDinner(taken, day, timeZone)) day++;
			taken.push(await this.planService.planMeal(actor, recipeId, day, 'DINNER', timeZone));
			day++;
		}
	}
}
