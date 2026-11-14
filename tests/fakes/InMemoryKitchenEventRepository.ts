import { v4 as uuid } from 'uuid';
import type { IKitchenEventRepository } from '../../src/lib/repositories/interfaces/IKitchenEventRepository';
import type { KitchenEvent, KitchenEventKind, NewKitchenEvent } from '../../src/lib/models/kitchen';

/** In-memory kitchen log. Events come back oldest first, as the real repository returns them. */
export class InMemoryKitchenEventRepository implements IKitchenEventRepository {
	private events: KitchenEvent[] = [];

	async append(event: NewKitchenEvent): Promise<KitchenEvent> {
		const stored: KitchenEvent = {
			id: uuid(),
			householdId: event.householdId,
			actorUserId: event.actorUserId ?? null,
			occurredAt: event.occurredAt,
			kind: event.kind,
			itemKey: event.itemKey ?? null,
			quantity: event.quantity ?? null,
			unit: event.unit ?? null,
			expiresAt: event.expiresAt ?? null,
			known: event.known ?? true,
			portions: event.portions ?? null,
			receiptItemId: event.receiptItemId ?? null,
			plannedMealId: event.plannedMealId ?? null,
			recipeId: event.recipeId ?? null,
			method: event.method ?? null,
			payload: event.payload ?? null,
			createdAt: new Date()
		};
		this.events.push(stored);
		return stored;
	}

	async appendMany(events: NewKitchenEvent[]): Promise<KitchenEvent[]> {
		const stored: KitchenEvent[] = [];
		for (const event of events) stored.push(await this.append(event));
		return stored;
	}

	async listByHouseholdSince(householdId: string, since: Date): Promise<KitchenEvent[]> {
		return this.sorted().filter(
			(event) => event.householdId === householdId && event.occurredAt >= since
		);
	}

	async listByKind(
		householdId: string,
		kind: KitchenEventKind,
		since?: Date
	): Promise<KitchenEvent[]> {
		return this.sorted().filter(
			(event) =>
				event.householdId === householdId &&
				event.kind === kind &&
				(!since || event.occurredAt >= since)
		);
	}

	async deleteByReceiptItemIds(householdId: string, receiptItemIds: string[]): Promise<void> {
		this.events = this.events.filter(
			(event) =>
				event.householdId !== householdId ||
				!event.receiptItemId ||
				!receiptItemIds.includes(event.receiptItemId)
		);
	}

	// Test helpers

	/** Every stored event of the household, oldest first. */
	all(householdId: string): KitchenEvent[] {
		return this.sorted().filter((event) => event.householdId === householdId);
	}

	private sorted(): KitchenEvent[] {
		return [...this.events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
	}
}
