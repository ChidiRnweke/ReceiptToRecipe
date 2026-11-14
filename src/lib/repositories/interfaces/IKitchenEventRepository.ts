import type { KitchenEvent, KitchenEventKind, NewKitchenEvent } from '$lib/models/kitchen';

/** The household's append-only kitchen log. */
export interface IKitchenEventRepository {
	append(event: NewKitchenEvent): Promise<KitchenEvent>;
	appendMany(events: NewKitchenEvent[]): Promise<KitchenEvent[]>;
	/** Events at or after `since`, oldest first. */
	listByHouseholdSince(householdId: string, since: Date): Promise<KitchenEvent[]>;
	/** Events of one kind, oldest first, optionally only those at or after `since`. */
	listByKind(householdId: string, kind: KitchenEventKind, since?: Date): Promise<KitchenEvent[]>;
	/** Forgets purchases whose receipt lines were deleted. */
	deleteByReceiptItemIds(householdId: string, receiptItemIds: string[]): Promise<void>;
}
