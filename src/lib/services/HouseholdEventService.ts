import type { IHouseholdEventRepository } from '$repositories';
import type {
	HouseholdEvent,
	HouseholdEventKind,
	HouseholdEventPayload
} from '$lib/models/household';
import type { EventAuthor, IHouseholdEventService } from './interfaces/IHouseholdEventService';

const HOUR_MS = 60 * 60 * 1000;
/** An eating-out is looked for this far back: it was said at most a local day ago. */
const EATING_OUT_LOOKBACK_HOURS = 36;
/** A shop is undone soon after it was recorded. */
const SHOP_UNDO_LOOKBACK_HOURS = 24;

export class HouseholdEventService implements IHouseholdEventService {
	constructor(private householdEventRepository: IHouseholdEventRepository) {}

	recordShopDone(
		author: EventAuthor,
		at: Date,
		ref: { shopId?: string; receiptId?: string }
	): Promise<HouseholdEvent> {
		return this.record(author, 'SHOP_DONE', at, { ...ref });
	}

	recordPlanned(author: EventAuthor, at: Date, from: number, to: number): Promise<HouseholdEvent> {
		return this.record(author, 'PLANNED', at, { from, to });
	}

	recordEatingOut(author: EventAuthor, at: Date, day: number): Promise<HouseholdEvent> {
		return this.record(author, 'EATING_OUT', at, { day });
	}

	recordCooked(author: EventAuthor, at: Date, title: string): Promise<HouseholdEvent> {
		return this.record(author, 'COOKED', at, { title });
	}

	recordJoined(author: EventAuthor, at: Date): Promise<HouseholdEvent> {
		return this.record(author, 'JOINED', at, {});
	}

	async recent(householdId: string, now: Date, hours: number): Promise<HouseholdEvent[]> {
		const events = await this.householdEventRepository.listSince(
			householdId,
			new Date(now.getTime() - hours * HOUR_MS)
		);
		return events.filter((event) => event.createdAt.getTime() <= now.getTime());
	}

	async isEatingOut(householdId: string, day: number, now: Date): Promise<boolean> {
		return (await this.eatingOut(householdId, day, now)).length > 0;
	}

	async clearEatingOut(householdId: string, day: number, now: Date): Promise<void> {
		const events = await this.eatingOut(householdId, day, now);
		await this.householdEventRepository.deleteByIds(
			householdId,
			events.map((event) => event.id)
		);
	}

	async forgetShop(householdId: string, shopId: string, now: Date): Promise<void> {
		const events = await this.recent(householdId, now, SHOP_UNDO_LOOKBACK_HOURS);
		await this.householdEventRepository.deleteByIds(
			householdId,
			events
				.filter((event) => event.kind === 'SHOP_DONE' && event.payload.shopId === shopId)
				.map((event) => event.id)
		);
	}

	private async eatingOut(householdId: string, day: number, now: Date): Promise<HouseholdEvent[]> {
		const events = await this.recent(householdId, now, EATING_OUT_LOOKBACK_HOURS);
		return events.filter((event) => event.kind === 'EATING_OUT' && event.payload.day === day);
	}

	private record(
		author: EventAuthor,
		kind: HouseholdEventKind,
		at: Date,
		payload: HouseholdEventPayload
	): Promise<HouseholdEvent> {
		return this.householdEventRepository.append({
			householdId: author.householdId,
			actorUserId: author.userId,
			kind,
			payload,
			createdAt: at
		});
	}
}
