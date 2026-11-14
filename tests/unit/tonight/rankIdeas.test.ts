import { describe, it, expect } from 'vitest';
import { rankIdeas, type RankStock } from '../../../src/lib/services/tonight';
import type { PlanRecipe } from '../../../src/lib/models/plan';

const DAY = 100;

function recipe(id: string, items: [string, number, string][]): PlanRecipe {
	return {
		id,
		title: id,
		ingredients: items.map(([itemKey, quantity, unit]) => ({ itemKey, quantity, unit }))
	};
}

function stock(
	itemKey: string,
	quantity: number,
	unit: string,
	expiresIn: number,
	perishable = true
): RankStock {
	return {
		itemKey,
		quantity,
		unit,
		expiresOn: DAY + expiresIn,
		known: true,
		off: false,
		perishable
	};
}

const pasta = recipe('pasta', [['pasta', 200, 'g']]);
const saag = recipe('saag', [
	['spinach', 200, 'g'],
	['rice', 150, 'g']
]);
const tacos = recipe('tacos', [
	['tortillas', 6, 'count'],
	['coriander', 1, 'bunch']
]);

const kitchen = [
	stock('pasta', 500, 'g', 300, false),
	stock('rice', 1000, 'g', 300, false),
	stock('spinach', 250, 'g', 1)
];

const tracking = { day: DAY, tracksKitchen: true };

describe('rankIdeas', () => {
	it('puts the recipe that uses an expiring item first', () => {
		const ranked = rankIdeas([pasta, saag], kitchen, [], tracking);
		expect(ranked[0].recipe.id).toBe('saag');
	});

	it('names the expiring item the recipe uses', () => {
		const [first] = rankIdeas([saag], kitchen, [], tracking);
		expect(first.uses).toEqual(['spinach']);
	});

	it('does not count a perishable that keeps for days as used', () => {
		const fresh = [stock('spinach', 250, 'g', 5)];
		const [first] = rankIdeas([saag], fresh, [], tracking);
		expect(first.uses).toEqual([]);
	});

	it('ranks a recipe with missing items lower', () => {
		const ranked = rankIdeas([tacos, pasta], kitchen, [], tracking);
		expect(ranked[0].recipe.id).toBe('pasta');
	});

	it('lists what is missing', () => {
		const [first] = rankIdeas([tacos], kitchen, [], tracking);
		expect(first.missing).toEqual(['tortillas', 'coriander']);
	});

	it('counts too little of an item as missing', () => {
		const little = [stock('pasta', 50, 'g', 300, false)];
		const [first] = rankIdeas([pasta], little, [], tracking);
		expect(first.missing).toEqual(['pasta']);
	});

	it('matches a plural ingredient to the item in the kitchen', () => {
		const eggs = recipe('omelette', [['eggs', 3, 'count']]);
		const [first] = rankIdeas([eggs], [stock('egg', 6, 'count', 10)], [], tracking);
		expect(first.missing).toEqual([]);
	});

	it('pushes down a recipe planned in the next three days', () => {
		const twin = recipe('pasta-2', [['pasta', 200, 'g']]);
		const ranked = rankIdeas([pasta, twin], kitchen, ['pasta'], tracking);
		expect(ranked[0].recipe.id).toBe('pasta-2');
	});

	it('leaves out excluded recipes', () => {
		const ranked = rankIdeas([pasta, saag], kitchen, [], { ...tracking, exclude: ['saag'] });
		expect(ranked.map((idea) => idea.recipe.id)).toEqual(['pasta']);
	});

	it('returns three ideas by default', () => {
		const many = ['a', 'b', 'c', 'd'].map((id) => recipe(id, [['pasta', 100, 'g']]));
		expect(rankIdeas(many, kitchen, [], tracking)).toHaveLength(3);
	});

	describe('for a household that does not track', () => {
		const untracked = { day: DAY, tracksKitchen: false };
		const staples = recipe('arrabbiata', [
			['pasta', 200, 'g'],
			['red onions', 1, 'count'],
			['garlic', 2, 'clove'],
			['chopped tomatoes', 1, 'can']
		]);

		it('assumes the staples are home', () => {
			const [first] = rankIdeas([staples], [], [], untracked);
			expect(first.missing).toEqual([]);
		});

		it('assumes the ingredients of recipes it cooked or saved are home', () => {
			const halloumi = recipe('halloumi', [['halloumi', 250, 'g']]);
			const [first] = rankIdeas([halloumi], [], [], { ...untracked, known: ['halloumi'] });
			expect(first.missing).toEqual([]);
		});

		it('still lists other ingredients as missing', () => {
			const [first] = rankIdeas([tacos], [], [], untracked);
			expect(first.missing).toEqual(['tortillas', 'coriander']);
		});
	});

	it('does not assume staples for a household that tracks', () => {
		const onion = recipe('soup', [['onion', 2, 'count']]);
		const [first] = rankIdeas([onion], [], [], tracking);
		expect(first.missing).toEqual(['onion']);
	});
});
