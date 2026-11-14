import { describe, it, expect } from 'vitest';
import { atLocalHour, dayNumber } from '../../../src/lib/services/kitchen';

const SUNDAY_25_OCTOBER = dayNumber(new Date('2026-10-25T12:00:00Z'), 'UTC');

describe('atLocalHour', () => {
	it('finds noon of a local day in summer time', () => {
		const date = atLocalHour(SUNDAY_25_OCTOBER - 1, 12, 'Europe/Brussels');
		expect(date.toISOString()).toBe('2026-10-24T10:00:00.000Z');
	});

	it('finds noon on the day the clocks go back', () => {
		const date = atLocalHour(SUNDAY_25_OCTOBER, 12, 'Europe/Brussels');
		expect(date.toISOString()).toBe('2026-10-25T11:00:00.000Z');
	});

	it('finds midnight of a local day ahead of UTC', () => {
		const date = atLocalHour(SUNDAY_25_OCTOBER, 0, 'Asia/Tokyo');
		expect(date.toISOString()).toBe('2026-10-24T15:00:00.000Z');
	});
});
