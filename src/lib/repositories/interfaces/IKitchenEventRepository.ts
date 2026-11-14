import type { KitchenEvent, KitchenEventKind, NewKitchenEvent } from '$lib/models/kitchen';

/** The household's append-only kitchen log. */
export interface IKitchenEventRepository {
	append(event: NewKitchenEvent): Promise<KitchenEvent>;
	appendMany(events: NewKitchenEvent[]): Promise<KitchenEvent[]>;
	/** Events at or after `since`, oldest first. */
	listByHouseholdSince(householdId: string, since: Date): Promise<KitchenEvent[]>;
	/** Events of one kind, oldest first, optionally only those at or after `since`. */
	listByKind(householdId: string, kind: KitchenEventKind, since?: Date): Promise<KitchenEvent[]>;
	/** The events of one shop: its BOUGHT events and its SHOP_DONE, by their `shopId`. */
	listByShopId(householdId: string, shopId: string): Promise<KitchenEvent[]>;
	deleteByIds(householdId: string, ids: string[]): Promise<void>;
	/** Forgets purchases whose receipt lines were deleted. */
	deleteByReceiptItemIds(householdId: string, receiptItemIds: string[]): Promise<void>;
	/** Deletes the events of the given kinds written for a cupboard row; returns what it deleted. */
	deleteByCupboardItem(
		householdId: string,
		cupboardItemId: string,
		kinds: KitchenEventKind[]
	): Promise<KitchenEvent[]>;
}
