import type {
	IHouseholdRepository,
	IKitchenEventRepository,
	IMealLogRepository,
	IPlannedMealRepository,
	IRecipeIngredientRepository,
	IRecipeRepository,
	PlannedMealDao
} from '$repositories';
import type { KitchenEvent, NewKitchenEvent, UsedIngredient } from '$lib/models/kitchen';
import type {
	BoughtItem,
	CorrectionInput,
	IKitchenService,
	KitchenAuthor,
	KitchenPicture,
	RecordCookedInput,
	RecordShopClosedInput,
	RecordShopDoneInput,
	WithdrawCupboardItemInput
} from './interfaces/IKitchenService';
import {
	dayNumber,
	normalizeItemKey,
	pictureEvents,
	projectKitchen,
	stockAt,
	toBaseUnit
} from './kitchen';
import { householdTimeZone } from './householdTimeZone';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back the picture looks for purchases that may still be good (tins, rice, frozen). */
const PICTURE_LOOKBACK_DAYS = 730;

export class KitchenService implements IKitchenService {
	constructor(
		private kitchenEventRepository: IKitchenEventRepository,
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private plannedMealRepository: IPlannedMealRepository,
		private mealLogRepository: IMealLogRepository,
		private householdRepository: Pick<IHouseholdRepository, 'findHouseholdById'>
	) {}

	timeZoneOf(householdId: string): Promise<string> {
		return householdTimeZone(this.householdRepository, householdId);
	}

	async getPicture(householdId: string, now: Date, zone?: string): Promise<KitchenPicture> {
		const timeZone = zone ?? (await householdTimeZone(this.householdRepository, householdId));
		const since = new Date(now.getTime() - PICTURE_LOOKBACK_DAYS * DAY_MS);
		const events = await this.kitchenEventRepository.listByHouseholdSince(householdId, since);
		const lots = projectKitchen(pictureEvents(events, now, timeZone), now, timeZone);
		const day = dayNumber(now, timeZone);
		const past = events.filter((event) => event.occurredAt.getTime() <= now.getTime());
		const shops = past.filter((event) => event.kind === 'SHOP_DONE');
		return {
			day,
			lots,
			stock: stockAt(lots, day),
			tracks: past.some((event) => event.kind === 'BOUGHT'),
			lastShopDoneAt: shops.length
				? new Date(Math.max(...shops.map((event) => event.occurredAt.getTime())))
				: null
		};
	}

	async recordCooked(input: RecordCookedInput): Promise<KitchenEvent> {
		const { actor } = input;
		const recipe = await this.recipeRepository.findById(input.recipeId);
		if (!recipe || recipe.householdId !== actor.householdId) throw new Error('Recipe not found');

		let plannedMeal: PlannedMealDao | null = null;
		if (input.plannedMealId) {
			plannedMeal = await this.plannedMealRepository.findById(input.plannedMealId);
			if (!plannedMeal || plannedMeal.householdId !== actor.householdId) {
				throw new Error('Planned meal not found');
			}
		}

		const extraPortions = Math.max(0, input.extraPortions ?? 0);
		// Portions put aside are cooked from the same pot, so they use ingredients too.
		const factor = (input.servings + extraPortions) / (recipe.servings > 0 ? recipe.servings : 1);
		const ingredients = await this.recipeIngredientRepository.findByRecipeId(recipe.id);
		const used: UsedIngredient[] = ingredients
			.filter((ingredient) => !ingredient.optional)
			.map((ingredient) => {
				const itemKey = normalizeItemKey(ingredient.name);
				const quantity = parseFloat(ingredient.quantity) * factor;
				const base = toBaseUnit(quantity, ingredient.unit);
				return base
					? { itemKey, quantity: base.quantity, unit: base.unit }
					: { itemKey, quantity, unit: ingredient.unit, estimate: true };
			});

		const event = await this.kitchenEventRepository.append({
			householdId: actor.householdId,
			actorUserId: actor.userId,
			occurredAt: input.at,
			kind: 'COOKED',
			recipeId: recipe.id,
			plannedMealId: plannedMeal?.id ?? null,
			portions: extraPortions > 0 ? extraPortions : null,
			payload: { ingredients: used, servings: input.servings }
		});

		if (plannedMeal) {
			await this.plannedMealRepository.update(plannedMeal.id, {
				status: 'COOKED',
				servings: input.servings
			});
		}

		await this.mealLogRepository.create({
			userId: actor.userId,
			recipeId: recipe.id,
			foodName: recipe.title,
			calories: recipe.estimatedCalories ?? plannedMeal?.plannedCalories ?? 0,
			consumedAt: input.at,
			mealType: plannedMeal?.mealType ?? 'DINNER'
		});

		return event;
	}

	async correct(input: CorrectionInput): Promise<KitchenEvent> {
		return this.kitchenEventRepository.append({
			householdId: input.actor.householdId,
			actorUserId: input.actor.userId,
			occurredAt: input.at,
			kind: input.kind,
			itemKey: normalizeItemKey(input.itemKey),
			quantity: input.kind === 'CORRECTED_QUANTITY' ? (input.quantity ?? 0) : null,
			unit: input.unit ?? null,
			cupboardItemId: input.cupboardItemId ?? null,
			payload: input.category ? { category: input.category } : null
		});
	}

	async withdrawCupboardItem(input: WithdrawCupboardItemInput): Promise<KitchenEvent[]> {
		const removed = await this.kitchenEventRepository.deleteByCupboardItem(
			input.actor.householdId,
			input.cupboardItemId,
			['BOUGHT', 'CORRECTED_QUANTITY']
		);
		if (removed.some((event) => event.kind === 'BOUGHT')) return [];
		const gone = await this.correct({
			actor: input.actor,
			itemKey: input.itemName,
			kind: 'CORRECTED_GONE',
			at: input.at
		});
		return [gone];
	}

	async recordShopDone(input: RecordShopDoneInput): Promise<KitchenEvent[]> {
		const bought = this.boughtEvents(
			input.author,
			input.items,
			input.at,
			input.method.toLowerCase()
		);
		return this.kitchenEventRepository.appendMany([
			...bought,
			this.shopDoneEvent({ ...input, itemCount: bought.length })
		]);
	}

	async recordShopClosed(input: RecordShopClosedInput): Promise<KitchenEvent> {
		return this.kitchenEventRepository.append(this.shopDoneEvent(input));
	}

	private shopDoneEvent(input: RecordShopClosedInput): NewKitchenEvent {
		return {
			householdId: input.author.householdId,
			actorUserId: input.author.userId,
			occurredAt: input.at,
			kind: 'SHOP_DONE',
			method: input.method,
			payload: { ...input.details, itemCount: input.itemCount }
		};
	}

	async recordBought(
		author: KitchenAuthor,
		items: BoughtItem[],
		at: Date,
		source: string
	): Promise<KitchenEvent[]> {
		return this.kitchenEventRepository.appendMany(this.boughtEvents(author, items, at, source));
	}

	async forgetReceiptItems(householdId: string, receiptItemIds: string[]): Promise<void> {
		await this.kitchenEventRepository.deleteByReceiptItemIds(householdId, receiptItemIds);
	}

	private boughtEvents(
		author: KitchenAuthor,
		items: BoughtItem[],
		at: Date,
		source: string
	): NewKitchenEvent[] {
		return items
			.map((item) => ({ item, itemKey: normalizeItemKey(item.name) }))
			.filter(({ itemKey }) => itemKey.length > 0)
			.map(({ item, itemKey }) => ({
				householdId: author.householdId,
				actorUserId: author.userId,
				occurredAt: at,
				kind: 'BOUGHT' as const,
				itemKey,
				quantity: item.quantity ?? null,
				unit: item.unit ?? null,
				expiresAt: item.expiresAt ?? null,
				known: true,
				receiptItemId: item.receiptItemId ?? null,
				cupboardItemId: item.cupboardItemId ?? null,
				payload: { category: item.category ?? null, source }
			}));
	}
}
