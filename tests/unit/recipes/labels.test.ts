import { describe, it, expect } from 'vitest';
import { listNames, madeLabel, matchKitchen, recipeMeta } from '../../../src/lib/services/recipes';

// Saturday 14 November 2026, 18:00 local time.
const NOW = new Date(2026, 10, 14, 18, 0);

describe('madeLabel', () => {
	it('says today for earlier the same day', () => {
		expect(madeLabel(new Date(2026, 10, 14, 8, 0), NOW)).toBe('made today');
	});

	it('says yesterday for the day before, even late at night', () => {
		expect(madeLabel(new Date(2026, 10, 13, 23, 30), NOW)).toBe('made yesterday');
	});

	it('names the weekday within the last week', () => {
		expect(madeLabel(new Date(2026, 10, 9, 19, 0), NOW)).toBe('made Mon');
	});

	it('says before for a week or longer ago', () => {
		expect(madeLabel(new Date(2026, 10, 7, 19, 0), NOW)).toBe('made before');
	});
});

describe('recipeMeta', () => {
	it('puts when it was made before the time', () => {
		const meta = recipeMeta(
			{ madeAt: new Date(2026, 10, 9, 19, 0), source: 'GENERATED', totalMinutes: 35 },
			NOW
		);

		expect(meta).toBe('made Mon · 35 min');
	});

	it('says a made-up recipe was made up for you', () => {
		expect(recipeMeta({ madeAt: null, source: 'GENERATED', totalMinutes: null }, NOW)).toBe(
			'made up for you'
		);
	});

	it('says a snapped recipe came from your photo', () => {
		expect(recipeMeta({ madeAt: null, source: 'SNAPPED', totalMinutes: 20 }, NOW)).toBe(
			'from your photo · 20 min'
		);
	});

	it('says a cookbook recipe came from the cookbook', () => {
		expect(recipeMeta({ madeAt: null, source: 'RAG', totalMinutes: null }, NOW)).toBe(
			'from the cookbook'
		);
	});
});

describe('listNames', () => {
	it('joins the last two names with "and"', () => {
		expect(listNames(['spinach', 'feta', 'eggs'])).toBe('spinach, feta and eggs');
	});
});

describe('matchKitchen', () => {
	const ingredients = [
		{ name: 'Spinach', optional: false },
		{ name: 'feta', optional: false },
		{ name: 'olive oil', optional: false },
		{ name: 'chilli flakes', optional: true }
	];

	it('uses what the kitchen holds, matching a longer stock name', () => {
		expect(matchKitchen(ingredients, ['baby spinach']).uses).toEqual(['spinach']);
	});

	it('matches a plural ingredient to the singular stock key, keeping the recipe name', () => {
		const berries = [{ name: 'Blueberries', optional: false }];
		expect(matchKitchen(berries, ['blueberry']).uses).toEqual(['blueberries']);
	});

	it('needs what the kitchen lacks, without staples or optional extras', () => {
		expect(matchKitchen(ingredients, ['baby spinach']).need).toEqual(['feta']);
	});
});
