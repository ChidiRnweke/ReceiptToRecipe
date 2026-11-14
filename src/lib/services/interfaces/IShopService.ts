import type { Actor } from '$lib/models/household';
import type {
	ListItem,
	Purchase,
	PurchaseUndo,
	ReconcilePlan,
	RestorableItem,
	ShopList
} from '$lib/models/shop';

export interface NewManualItem {
	name: string;
	quantity?: number | null;
	unit?: string | null;
}

/** The household's live shopping list and its purchase history. */
export interface IShopService {
	/** The household's active list, created empty when it has none. */
	getList(actor: Actor): Promise<ShopList>;
	/** Writes a reconcile plan to the list. */
	applyPlan(list: ShopList, plan: ReconcilePlan): Promise<void>;
	/** Ticks or unticks one item. Only that row's flag changes, so two members never clash. */
	setChecked(actor: Actor, itemId: string, checked: boolean): Promise<ListItem>;
	/** An item a person adds by hand. */
	addManual(actor: Actor, item: NewManualItem): Promise<ListItem>;
	/** Removes an item a person added by hand, and returns it as it was. */
	removeManual(actor: Actor, itemId: string): Promise<ListItem>;
	/** Puts items that left the list back on the household's active list. */
	restoreItems(actor: Actor, items: RestorableItem[]): Promise<void>;
	/** Removes items of the household's list, e.g. the ones that came home. */
	removeItems(actor: Actor, itemIds: string[]): Promise<void>;
	/** Unticks items of the household's list. */
	untick(actor: Actor, itemIds: string[]): Promise<void>;
	/**
	 * Counts the purchases in the purchase history, like completing a shopping list did. Returns
	 * how each row was before, so `undoPurchases` can take the count back.
	 */
	recordPurchases(actor: Actor, purchases: Purchase[], at: Date): Promise<PurchaseUndo[]>;
	/** Puts purchase-history rows back as `recordPurchases` found them. */
	undoPurchases(actor: Actor, undo: PurchaseUndo[]): Promise<void>;
}
