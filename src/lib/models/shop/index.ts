/**
 * Types of the Shop door.
 *
 * The Shop door answers "what do we need?" with one live household list. The plan writes most of
 * it: each planned dish adds what the kitchen will be short of by then. Usuals that run low join
 * it, and people add the rest by hand. Fresh things needed only after the next shop are held back
 * for the shop after it.
 */

import type { MealType } from '$lib/models/plan';
import type { ShopMethod } from '$lib/models/kitchen';

/** Who put an item on the list. */
export type ShoppingItemSource = 'PLAN' | 'USUAL' | 'MANUAL' | 'AGENT';

/** One ingredient of a planned meal, scaled to the servings planned. */
export interface ShopIngredient {
	itemKey: string;
	/** The ingredient's name as the recipe writes it. */
	name: string;
	quantity: number;
	unit: string;
}

/** A planned meal as the shop rules see it. */
export interface ShopMeal {
	id: string;
	title: string;
	imageUrl: string | null;
	/** Local day of the meal. */
	day: number;
	mealType: MealType;
	/** A prep session: cooked ahead for the days after. */
	prep?: boolean;
	ingredients: ShopIngredient[];
	/** Portions the meal puts aside for later meals. */
	portions?: number;
}

/** An amount to buy of one item. */
export interface ShopNeedItem {
	itemKey: string;
	name: string;
	/** Rounded up to a pack size; null when the amount is not known. */
	quantity: number | null;
	unit: string | null;
	/** The planned meals it is bought for, the meal it is listed under first. */
	mealIds: string[];
	/** Local days of the other meals that need it ("also Tue"). */
	alsoDays: number[];
}

export interface ShopNeedGroup {
	meal: ShopMeal;
	items: ShopNeedItem[];
}

/** A learned shop moment. */
export interface ShopMoment {
	day: number;
	at: Date;
}

/** What the household needs, by when. */
export interface ShopNeeds {
	/** The learned shop within 36 hours that the list is for, or null for "Next shop". */
	nextShop: ShopMoment | null;
	/** The learned shop after it: held-back items wait for this one. */
	afterShop: ShopMoment | null;
	/** Dishes up to the shop after next, each with what it is short of. */
	now: ShopNeedGroup[];
	/** Usual items that are running low. */
	usuals: ShopNeedItem[];
	/** Dishes after the shop after next: their fresh things wait for that shop. */
	later: ShopNeedGroup[];
}

/** A list item as the reconcile and match rules read it. */
export interface ListItem {
	id: string;
	name: string;
	source: ShoppingItemSource;
	mergeKey: string | null;
	quantity: number | null;
	unit: string | null;
	checked: boolean;
	heldUntil: Date | null;
	forPlannedMealIds: string[];
}

/** A row reconcile adds to the list. */
export interface NewListItem {
	name: string;
	source: Extract<ShoppingItemSource, 'PLAN' | 'USUAL'>;
	mergeKey: string;
	quantity: number | null;
	unit: string | null;
	heldUntil: Date | null;
	forPlannedMealIds: string[];
}

export interface ListItemPatch {
	name?: string;
	quantity?: number | null;
	heldUntil?: Date | null;
	forPlannedMealIds?: string[];
}

/** The changes that bring the persisted list in line with the needs. */
export interface ReconcilePlan {
	create: NewListItem[];
	update: { id: string; patch: ListItemPatch }[];
	remove: string[];
}

/** A receipt line as the match rule reads it. */
export interface ReceiptLineItem {
	id: string;
	itemKey: string;
	name: string;
	quantity: number | null;
	unit: string | null;
}

export interface ReceiptMatch<R, L> {
	/** Receipt lines that bought a list item. */
	matched: { line: R; item: L }[];
	/** Receipt lines that were not on the list. */
	extras: R[];
	/** List items that are not on the receipt. */
	missing: L[];
}

/** One ingredient of an idea, in the kitchen's base unit when it has one. */
export interface IdeaIngredient {
	itemKey: string;
	name: string;
	quantity: number;
	unit: string;
	/** What the kitchen holds of it, in the same unit. */
	have: number;
}

/** One line of a list, ready to show. */
export interface ShopLine {
	itemKey: string;
	name: string;
	quantity: number | null;
	unit: string | null;
}

// ─── What the page shows ───────────────────────────────────────────────

export interface ShopItemView {
	id: string;
	name: string;
	/** "150 g", "2", or "" when the amount is not known. */
	amount: string;
	checked: boolean;
	/** Short weekday names of the other meals that need it. */
	also: string[];
	source: ShoppingItemSource;
}

export interface ShopGroupView {
	mealId: string;
	title: string;
	imageUrl: string | null;
	/** "Today", "Tomorrow", "Saturday", with ", prep" for a prep session. */
	when: string;
	items: ShopItemView[];
}

export interface HeldItemView {
	name: string;
	/** Short weekday names of the meals that need it. */
	days: string[];
	amount: string;
}

export interface ShopIdeaView {
	recipeId: string;
	title: string;
	imageUrl: string | null;
	uses: string[];
	missing: string[];
	ingredients: IdeaIngredient[];
}

export type ShopEmpty = 'plan-first' | 'nothing-needed';

export interface ShopView {
	greeting: string;
	question: string;
	/** "Thursday’s shop" or "Next shop". */
	title: string;
	/** Things on the list for this shop. */
	count: number;
	/** `list` shows the plan's list; `ideas` lets a household that does not plan tick dinners. */
	mode: 'list' | 'ideas';
	groups: ShopGroupView[];
	usuals: ShopItemView[];
	/** Items people added by hand. */
	manual: ShopItemView[];
	held: { shop: string; items: HeldItemView[] } | null;
	empty: ShopEmpty | null;
	/** How this member usually finishes a shop; RECEIPT until a habit is learned. */
	doneHabit: ShopMethod;
	/** The list has something on it, so the end buttons show. */
	hasList: boolean;
	ideas: ShopIdeaView[];
	/** The kitchen records purchases. */
	tracks: boolean;
}

export interface GotEverythingResult {
	recorded: number;
	message: string;
}

export type ReceiptStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface ReceiptSlipView {
	store: string;
	when: string;
	lines: { name: string; qty: string; price: number }[];
	total: number;
	currency: string;
}

export interface CameHomeView {
	/** The list had items to match against. */
	fromList: boolean;
	matched: number;
	extras: { name: string; amount: string }[];
	missing: { name: string }[];
}

export interface ReceiptResult {
	status: ReceiptStatus;
	error: string | null;
	slip: ReceiptSlipView | null;
	cameHome: CameHomeView | null;
}

export interface ConfirmResult {
	message: string;
}

/** The household's live list. */
export interface ShopList {
	id: string;
	items: ListItem[];
}

/** A thing bought, for the purchase history. */
export interface Purchase {
	name: string;
	quantity: number | null;
}
