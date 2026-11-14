export type FreshnessTone = 'high' | 'mid' | 'low' | 'off';

export interface FreshnessLevel {
	/** Filled dots out of five. */
	dots: number;
	tone: FreshnessTone;
}

export const FRESHNESS_DOTS = 5;

/**
 * How fresh an item looks, from the whole days left before it expires.
 * Expiring today still shows one dot; past its date it shows none and reads as gone off.
 */
export function freshnessLevel(daysLeft: number): FreshnessLevel {
	if (daysLeft < 0) return { dots: 0, tone: 'off' };
	const dots = Math.min(FRESHNESS_DOTS, Math.floor(daysLeft) + 1);
	const tone: FreshnessTone = dots <= 1 ? 'low' : dots === 2 ? 'mid' : 'high';
	return { dots, tone };
}
