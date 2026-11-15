import type { Actor, HouseholdEvent } from '$lib/models/household';

/** Who an event is recorded for: a member, by their user and household. */
export type EventAuthor = Pick<Actor, 'userId' | 'householdId'>;

/**
 * What members did that the rest of the household hears about in "Needs you", and whether the
 * household is eating out today.
 */
export interface IHouseholdEventService {
	/** "Sam got the shopping": a shop closed, by ticking the list or with a receipt. */
	recordShopDone(
		author: EventAuthor,
		at: Date,
		ref: { shopId?: string; receiptId?: string }
	): Promise<HouseholdEvent>;
	/** "Noor planned Thu–Sun": the first and the last local day that got meals. */
	recordPlanned(author: EventAuthor, at: Date, from: number, to: number): Promise<HouseholdEvent>;
	/** "We're eating out" for the local day `day`. */
	recordEatingOut(author: EventAuthor, at: Date, day: number): Promise<HouseholdEvent>;
	/** "Noor cooked saag paneer". */
	recordCooked(author: EventAuthor, at: Date, title: string): Promise<HouseholdEvent>;
	/** A member joined the household. */
	recordJoined(author: EventAuthor, at: Date): Promise<HouseholdEvent>;
	/** The household's events from the last `hours` hours before `now`, newest first. */
	recent(householdId: string, now: Date, hours: number): Promise<HouseholdEvent[]>;
	/** True when a member said the household is eating out on the local day `day`. */
	isEatingOut(householdId: string, day: number, now: Date): Promise<boolean>;
	/** "Plans changed? We're eating in": forgets the eating-out of `day`. */
	clearEatingOut(householdId: string, day: number, now: Date): Promise<void>;
	/** Forgets the event of a shop that was undone. */
	forgetShop(householdId: string, shopId: string, now: Date): Promise<void>;
}
