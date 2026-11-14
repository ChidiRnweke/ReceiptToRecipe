import { describe, it, expect } from 'vitest';
import { freshnessLevel } from '../../../src/lib/services/doors/freshness';

describe('freshnessLevel', () => {
	it('shows no dots once an item is past its date', () => {
		expect(freshnessLevel(-1)).toEqual({ dots: 0, tone: 'off' });
	});

	it('shows one low dot for an item that expires today', () => {
		expect(freshnessLevel(0)).toEqual({ dots: 1, tone: 'low' });
	});

	it('shows two mid dots for an item that expires tomorrow', () => {
		expect(freshnessLevel(1)).toEqual({ dots: 2, tone: 'mid' });
	});

	it('shows three high dots with two days left', () => {
		expect(freshnessLevel(2)).toEqual({ dots: 3, tone: 'high' });
	});

	it('never shows more than five dots', () => {
		expect(freshnessLevel(30).dots).toBe(5);
	});
});
