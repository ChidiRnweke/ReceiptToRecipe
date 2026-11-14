/** An inclusive run of days, counted as day indices. */
export interface DayRange {
	start: number;
	end: number;
}

export interface RangePick {
	range: DayRange;
	/** True while the next tap will set the last day. */
	picking: boolean;
}

/**
 * Two-tap range picking on a day strip.
 * The first tap starts a one-day range; the second tap on or after the start sets the last day.
 * A tap before the start while picking starts again from that day.
 */
export function nextRange(range: DayRange | null, tappedDay: number, picking: boolean): RangePick {
	if (!picking || range === null || tappedDay < range.start) {
		return { range: { start: tappedDay, end: tappedDay }, picking: true };
	}
	return { range: { start: range.start, end: tappedDay }, picking: false };
}

export function inRange(range: DayRange | null, day: number): boolean {
	return range !== null && day >= range.start && day <= range.end;
}
