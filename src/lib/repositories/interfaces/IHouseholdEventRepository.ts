import type { HouseholdEvent, NewHouseholdEvent } from '$lib/models/household';

/** What members did that the rest of the household hears about. */
export interface IHouseholdEventRepository {
	append(event: NewHouseholdEvent): Promise<HouseholdEvent>;
	/** Events created at or after `since`, newest first. */
	listSince(householdId: string, since: Date): Promise<HouseholdEvent[]>;
	deleteByIds(householdId: string, ids: string[]): Promise<void>;
}
