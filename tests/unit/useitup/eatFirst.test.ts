import { describe, it, expect } from 'vitest';
import { eatFirst, frontNames, homeAmount } from '../../../src/lib/services/useitup';

const TODAY = 100;

const item = (
	itemKey: string,
	expiresIn: number,
	options: { off?: boolean; perishable?: boolean } = {}
) => ({
	itemKey,
	expiresOn: TODAY + expiresIn,
	off: options.off ?? false,
	perishable: options.perishable ?? true
});

describe('eatFirst', () => {
	it('keeps a perishable that expires within three days', () => {
		expect(eatFirst([item('spinach', 3)], TODAY).map((x) => x.itemKey)).toEqual(['spinach']);
	});

	it('leaves out a perishable with more than three days left', () => {
		expect(eatFirst([item('yogurt', 4)], TODAY)).toEqual([]);
	});

	it('leaves out an item that keeps, even when its date is near', () => {
		expect(eatFirst([item('rice', 1, { perishable: false })], TODAY)).toEqual([]);
	});

	it('keeps leftovers, which are not marked perishable', () => {
		const leftover = item('leftover:meal-1', 2, { perishable: false });
		expect(eatFirst([leftover], TODAY)).toEqual([leftover]);
	});

	it('keeps an item that has gone off', () => {
		expect(eatFirst([item('milk', -2, { off: true })], TODAY)).toHaveLength(1);
	});

	it('lists gone-off items first, then the soonest to expire', () => {
		const stock = [item('feta', 2), item('chicken', 0), item('milk', -1, { off: true })];
		expect(eatFirst(stock, TODAY).map((x) => x.itemKey)).toEqual(['milk', 'chicken', 'feta']);
	});
});

describe('frontNames', () => {
	it('names the first three items that have not gone off', () => {
		const first = [
			{ name: 'Milk', off: true },
			{ name: 'Feta', off: false },
			{ name: 'Yogurt', off: false },
			{ name: 'Chicken thighs', off: false },
			{ name: 'Spinach', off: false }
		];
		expect(frontNames(first)).toBe('feta, yogurt and chicken thighs');
	});

	it('is null when everything left has gone off', () => {
		expect(frontNames([{ name: 'Milk', off: true }])).toBeNull();
	});
});

describe('homeAmount', () => {
	it('counts one leftover portion in the singular', () => {
		expect(homeAmount(1, 'portion')).toBe('1 portion');
	});

	it('counts leftover portions in the plural', () => {
		expect(homeAmount(2, 'portion')).toBe('2 portions');
	});
});
