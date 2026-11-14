import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IKitchenEventRepository } from './interfaces';
import type {
	KitchenEvent,
	KitchenEventKind,
	KitchenEventPayload,
	NewKitchenEvent
} from '$lib/models/kitchen';

export class KitchenEventRepository implements IKitchenEventRepository {
	constructor(private db: Database) {}

	async append(event: NewKitchenEvent): Promise<KitchenEvent> {
		const [created] = await this.appendMany([event]);
		return created;
	}

	async appendMany(events: NewKitchenEvent[]): Promise<KitchenEvent[]> {
		if (events.length === 0) return [];
		const rows = await this.db
			.insert(schema.kitchenEvents)
			.values(events.map((event) => this.toRow(event)))
			.returning();
		return rows.map((row) => this.toEvent(row));
	}

	async listByHouseholdSince(householdId: string, since: Date): Promise<KitchenEvent[]> {
		const rows = await this.db.query.kitchenEvents.findMany({
			where: and(
				eq(schema.kitchenEvents.householdId, householdId),
				gte(schema.kitchenEvents.occurredAt, since)
			),
			orderBy: [asc(schema.kitchenEvents.occurredAt), asc(schema.kitchenEvents.createdAt)]
		});
		return rows.map((row) => this.toEvent(row));
	}

	async listByKind(
		householdId: string,
		kind: KitchenEventKind,
		since?: Date
	): Promise<KitchenEvent[]> {
		const rows = await this.db.query.kitchenEvents.findMany({
			where: and(
				eq(schema.kitchenEvents.householdId, householdId),
				eq(schema.kitchenEvents.kind, kind),
				since ? gte(schema.kitchenEvents.occurredAt, since) : undefined
			),
			orderBy: [asc(schema.kitchenEvents.occurredAt), asc(schema.kitchenEvents.createdAt)]
		});
		return rows.map((row) => this.toEvent(row));
	}

	async listByShopId(householdId: string, shopId: string): Promise<KitchenEvent[]> {
		const rows = await this.db.query.kitchenEvents.findMany({
			where: and(
				eq(schema.kitchenEvents.householdId, householdId),
				sql`${schema.kitchenEvents.payload}->>'shopId' = ${shopId}`
			),
			orderBy: [asc(schema.kitchenEvents.occurredAt), asc(schema.kitchenEvents.createdAt)]
		});
		return rows.map((row) => this.toEvent(row));
	}

	async deleteByIds(householdId: string, ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.db
			.delete(schema.kitchenEvents)
			.where(
				and(
					eq(schema.kitchenEvents.householdId, householdId),
					inArray(schema.kitchenEvents.id, ids)
				)
			);
	}

	async deleteByReceiptItemIds(householdId: string, receiptItemIds: string[]): Promise<void> {
		if (receiptItemIds.length === 0) return;
		await this.db
			.delete(schema.kitchenEvents)
			.where(
				and(
					eq(schema.kitchenEvents.householdId, householdId),
					inArray(schema.kitchenEvents.receiptItemId, receiptItemIds)
				)
			);
	}

	async deleteByCupboardItem(
		householdId: string,
		cupboardItemId: string,
		kinds: KitchenEventKind[]
	): Promise<KitchenEvent[]> {
		if (kinds.length === 0) return [];
		const rows = await this.db
			.delete(schema.kitchenEvents)
			.where(
				and(
					eq(schema.kitchenEvents.householdId, householdId),
					eq(schema.kitchenEvents.cupboardItemId, cupboardItemId),
					inArray(schema.kitchenEvents.kind, kinds)
				)
			)
			.returning();
		return rows.map((row) => this.toEvent(row));
	}

	private toRow(event: NewKitchenEvent): typeof schema.kitchenEvents.$inferInsert {
		return {
			householdId: event.householdId,
			actorUserId: event.actorUserId ?? null,
			occurredAt: event.occurredAt,
			kind: event.kind,
			itemKey: event.itemKey ?? null,
			quantity: event.quantity == null ? null : event.quantity.toString(),
			unit: event.unit ?? null,
			expiresAt: event.expiresAt ?? null,
			known: event.known ?? true,
			portions: event.portions ?? null,
			receiptItemId: event.receiptItemId ?? null,
			plannedMealId: event.plannedMealId ?? null,
			recipeId: event.recipeId ?? null,
			cupboardItemId: event.cupboardItemId ?? null,
			method: event.method ?? null,
			payload: event.payload ?? null
		};
	}

	private toEvent(row: typeof schema.kitchenEvents.$inferSelect): KitchenEvent {
		return {
			id: row.id,
			householdId: row.householdId,
			actorUserId: row.actorUserId,
			occurredAt: row.occurredAt,
			kind: row.kind,
			itemKey: row.itemKey,
			quantity: row.quantity === null ? null : parseFloat(row.quantity),
			unit: row.unit,
			expiresAt: row.expiresAt,
			known: row.known,
			portions: row.portions,
			receiptItemId: row.receiptItemId,
			plannedMealId: row.plannedMealId,
			recipeId: row.recipeId,
			cupboardItemId: row.cupboardItemId,
			method: row.method,
			payload: (row.payload as KitchenEventPayload | null) ?? null,
			createdAt: row.createdAt
		};
	}
}
