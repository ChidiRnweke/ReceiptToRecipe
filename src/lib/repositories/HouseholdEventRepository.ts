import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IHouseholdEventRepository } from './interfaces/IHouseholdEventRepository';
import {
	isHouseholdEventKind,
	type HouseholdEvent,
	type HouseholdEventPayload,
	type NewHouseholdEvent
} from '$lib/models/household';

export class HouseholdEventRepository implements IHouseholdEventRepository {
	constructor(private db: Database) {}

	async append(event: NewHouseholdEvent): Promise<HouseholdEvent> {
		const [row] = await this.db
			.insert(schema.householdEvents)
			.values({
				householdId: event.householdId,
				actorUserId: event.actorUserId,
				kind: event.kind,
				payload: event.payload ?? {},
				createdAt: event.createdAt
			})
			.returning();
		const stored = this.toEvent(row);
		if (!stored) throw new Error(`Unknown household event kind ${row.kind}`);
		return stored;
	}

	async listSince(householdId: string, since: Date): Promise<HouseholdEvent[]> {
		const rows = await this.db.query.householdEvents.findMany({
			where: and(
				eq(schema.householdEvents.householdId, householdId),
				gte(schema.householdEvents.createdAt, since)
			),
			orderBy: [desc(schema.householdEvents.createdAt)]
		});
		return rows.flatMap((row) => {
			const event = this.toEvent(row);
			return event ? [event] : [];
		});
	}

	async deleteByIds(householdId: string, ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.db
			.delete(schema.householdEvents)
			.where(
				and(
					eq(schema.householdEvents.householdId, householdId),
					inArray(schema.householdEvents.id, ids)
				)
			);
	}

	/** A row of a kind this version does not know is skipped rather than guessed at. */
	private toEvent(row: schema.HouseholdEventRow): HouseholdEvent | null {
		if (!isHouseholdEventKind(row.kind)) return null;
		return {
			id: row.id,
			householdId: row.householdId,
			actorUserId: row.actorUserId,
			kind: row.kind,
			payload: (row.payload ?? {}) as HouseholdEventPayload,
			createdAt: row.createdAt
		};
	}
}
