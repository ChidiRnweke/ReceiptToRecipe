import type { PlanRange } from '$lib/models/plan';

/**
 * The range the member picked on the Plan door; undefined means the default stretch. Basil reads
 * it to refresh the plan the member is looking at after a change.
 */
class PlanRangeState {
	picked = $state<PlanRange | undefined>(undefined);
}

export const planRange = new PlanRangeState();
