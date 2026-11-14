import { describe, it, expect } from 'vitest';
import type { StockItem } from '../../../src/lib/models/kitchen';
import { mayHaveAtHome } from '../../../src/lib/services/shop';

const stock = (itemKey: string, options: Partial<StockItem> = {}): StockItem => ({
	itemKey,
	quantity: 1,
	unit: 'l',
	expiresOn: 100,
	known: true,
	off: false,
	...options
});

describe('mayHaveAtHome', () => {
	it('is true for an item the kitchen holds', () => {
		expect(mayHaveAtHome('milk', [stock('milk')])).toBe(true);
	});

	it('is true for the plural of an item the kitchen holds', () => {
		expect(mayHaveAtHome('eggs', [stock('egg')])).toBe(true);
	});

	it('is false for an item the kitchen does not hold', () => {
		expect(mayHaveAtHome('milk', [stock('oat milk')])).toBe(false);
	});

	it('is false for an item of which only expired stock is left', () => {
		expect(mayHaveAtHome('milk', [stock('milk', { off: true })])).toBe(false);
	});

	it('is false for an item that is used up', () => {
		expect(mayHaveAtHome('milk', [stock('milk', { quantity: 0 })])).toBe(false);
	});
});
