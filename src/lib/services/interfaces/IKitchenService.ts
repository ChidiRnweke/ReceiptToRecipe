import type { Actor } from '$lib/models/household';
import type { KitchenEvent, Lot, ShopMethod, StockItem } from '$lib/models/kitchen';

/** Who a kitchen event is recorded for. A signed-in Actor qualifies, and so does a background job. */
export type KitchenAuthor = Pick<Actor, 'userId' | 'householdId'>;

export interface KitchenPicture {
	/** The local day the picture describes. */
	day: number;
	lots: Lot[];
	stock: StockItem[];
}

export interface BoughtItem {
	name: string;
	quantity?: number | null;
	unit?: string | null;
	category?: string | null;
	expiresAt?: Date | null;
	receiptItemId?: string | null;
}

export interface RecordCookedInput {
	actor: Actor;
	plannedMealId?: string | null;
	recipeId: string;
	/** Servings cooked to eat now. */
	servings: number;
	/** Portions put aside as leftovers or batch-cooked meals. */
	extraPortions?: number;
	at: Date;
}

export type CorrectionKind = 'CORRECTED_GONE' | 'CORRECTED_STILL_GOOD' | 'CORRECTED_QUANTITY';

export interface CorrectionInput {
	actor: Actor;
	itemKey: string;
	kind: CorrectionKind;
	/** The new total, for CORRECTED_QUANTITY. */
	quantity?: number | null;
	unit?: string | null;
	at: Date;
}

export interface RecordShopDoneInput {
	author: KitchenAuthor;
	method: ShopMethod;
	items: BoughtItem[];
	at: Date;
	/** Extra context kept on the SHOP_DONE event, e.g. the receipt id. */
	details?: Record<string, unknown>;
}

export interface IKitchenService {
	/** What the household's kitchen holds now, projected from its events. */
	getPicture(householdId: string, now: Date, timeZone: string): Promise<KitchenPicture>;
	recordCooked(input: RecordCookedInput): Promise<KitchenEvent>;
	correct(input: CorrectionInput): Promise<KitchenEvent>;
	/** One BOUGHT per item, then the SHOP_DONE that closes the shop. */
	recordShopDone(input: RecordShopDoneInput): Promise<KitchenEvent[]>;
	/** BOUGHT events outside a shop, such as an item added to the cupboard by hand. */
	recordBought(
		author: KitchenAuthor,
		items: BoughtItem[],
		at: Date,
		source: string
	): Promise<KitchenEvent[]>;
	/** Removes the purchases of deleted receipt lines. */
	forgetReceiptItems(householdId: string, receiptItemIds: string[]): Promise<void>;
}
