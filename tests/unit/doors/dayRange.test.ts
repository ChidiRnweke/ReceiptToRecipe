import { describe, it, expect } from 'vitest';
import { nextRange } from '../../../src/lib/services/doors/dayRange';

describe('nextRange', () => {
	it('starts a one-day range on the first tap', () => {
		expect(nextRange(null, 3, false).range).toEqual({ start: 3, end: 3 });
	});

	it('waits for the last day after the first tap', () => {
		expect(nextRange(null, 3, false).picking).toBe(true);
	});

	it('replaces a finished range on a new first tap', () => {
		expect(nextRange({ start: 1, end: 4 }, 6, false).range).toEqual({ start: 6, end: 6 });
	});

	it('sets the last day on a second tap after the start', () => {
		expect(nextRange({ start: 2, end: 2 }, 5, true).range).toEqual({ start: 2, end: 5 });
	});

	it('finishes picking on the second tap', () => {
		expect(nextRange({ start: 2, end: 2 }, 5, true).picking).toBe(false);
	});

	it('accepts a second tap on the start day as a one-day range', () => {
		expect(nextRange({ start: 2, end: 2 }, 2, true)).toEqual({
			range: { start: 2, end: 2 },
			picking: false
		});
	});

	it('restarts from a tap before the start', () => {
		expect(nextRange({ start: 4, end: 4 }, 1, true).range).toEqual({ start: 1, end: 1 });
	});

	it('keeps picking after a restart', () => {
		expect(nextRange({ start: 4, end: 4 }, 1, true).picking).toBe(true);
	});
});
