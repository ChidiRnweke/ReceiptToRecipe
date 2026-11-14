import type { IHouseholdRepository } from '$repositories';
import { DEFAULT_TIME_ZONE } from '$lib/models/household';

/** The household's stored time zone, or the default when the household cannot be found. */
export async function householdTimeZone(
	householdRepository: Pick<IHouseholdRepository, 'findHouseholdById'>,
	householdId: string
): Promise<string> {
	const household = await householdRepository.findHouseholdById(householdId);
	return household?.timeZone ?? DEFAULT_TIME_ZONE;
}
