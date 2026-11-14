import { describe, it, expect } from 'vitest';
import { keepsWell, mergePrepSteps, stretchLine } from '../../../src/lib/services/plan';
import { DAY0 } from '../../helpers/kitchenEvents';

describe('keepsWell', () => {
	it('keeps a curry', () => {
		expect(keepsWell({ title: 'Spinach & chickpea curry' })).toBe(true);
	});

	it('keeps a soup', () => {
		expect(keepsWell({ title: 'Roast tomato soup' })).toBe(true);
	});

	it('does not keep tacos', () => {
		expect(keepsWell({ title: 'Chicken tacos' })).toBe(false);
	});
});

describe('mergePrepSteps', () => {
	const curry = { title: 'Chickpea curry', steps: ['Sweat the onion, 8 min.', 'Simmer 15 min.'] };
	const rice = { title: 'Lemon rice', steps: ['1. Boil the rice, 12 min.', 'Fold in the lemon.'] };

	it('starts with the long waits, whichever dish they belong to', () => {
		expect(mergePrepSteps([curry, rice])[0]).toEqual({
			verb: 'Boil',
			text: 'the rice, 12 min.',
			dish: 'rice'
		});
	});

	it('ends with the finishing steps', () => {
		expect(mergePrepSteps([curry, rice]).at(-1)?.verb).toBe('Fold');
	});
});

describe('stretchLine', () => {
	// DAY0 is a Monday.
	it('names the shop that ends the stretch', () => {
		expect(stretchLine({ start: DAY0 + 4, end: DAY0 + 7, reason: 'until-shop' })).toBe(
			'Until your Monday shop.'
		);
	});

	it('names the first and last day of a picked range', () => {
		expect(stretchLine({ start: DAY0 + 4, end: DAY0 + 9, reason: 'custom' })).toBe(
			'Friday to Tuesday.'
		);
	});
});
