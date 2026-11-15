import { v4 as uuid } from 'uuid';
import type { IHouseholdEventRepository } from '../../src/lib/repositories/interfaces/IHouseholdEventRepository';
import type { HouseholdEvent, NewHouseholdEvent } from '../../src/lib/models/household';

/** In-memory household events, returned newest first as the real repository returns them. */
export class InMemoryHouseholdEventRepository implements IHouseholdEventRepository {
	events: HouseholdEvent[] = [];

	async append(event: NewHouseholdEvent): Promise<HouseholdEvent> {
		const stored: HouseholdEvent = {
			id: uuid(),
			householdId: event.householdId,
			actorUserId: event.actorUserId,
			kind: event.kind,
			payload: event.payload ?? {},
			createdAt: event.createdAt
		};
		this.events.push(stored);
		return stored;
	}

	async listSince(householdId: string, since: Date): Promise<HouseholdEvent[]> {
		return this.events
			.filter((e) => e.householdId === householdId && e.createdAt.getTime() >= since.getTime())
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async deleteByIds(householdId: string, ids: string[]): Promise<void> {
		this.events = this.events.filter((e) => e.householdId !== householdId || !ids.includes(e.id));
	}
}
