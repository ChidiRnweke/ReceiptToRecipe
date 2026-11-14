import { describe, it, expect } from 'vitest';
import { pickForGaps, type PlanCandidate } from '../../../src/lib/services/plan';
import type { PlanGap } from '../../../src/lib/models/plan';

function candidate(id: string, overrides: Partial<PlanCandidate> = {}): PlanCandidate {
	return { id, calories: 600, uses: [], missing: [], ...overrides };
}

const gaps: PlanGap[] = [
	{ day: 1, mealType: 'DINNER' },
	{ day: 2, mealType: 'DINNER' },
	{ day: 3, mealType: 'DINNER' }
];
const free = { calorieTarget: null, alreadyPlanned: [] };

describe('pickForGaps', () => {
	it('never picks the same recipe twice in a range', () => {
		const picks = pickForGaps([candidate('a'), candidate('b'), candidate('c')], gaps, free);
		expect(new Set(picks.map((p) => p.recipeId)).size).toBe(3);
	});

	it('does not pick a recipe already planned in the range', () => {
		const picks = pickForGaps([candidate('a'), candidate('b')], gaps.slice(0, 1), {
			calorieTarget: null,
			alreadyPlanned: ['a']
		});
		expect(picks[0]?.recipeId).toBe('b');
	});

	it('leaves gaps open when it runs out of recipes', () => {
		expect(pickForGaps([candidate('a')], gaps, free)).toHaveLength(1);
	});

	it('puts the recipe that uses expiring stock first', () => {
		const picks = pickForGaps(
			[candidate('pasta'), candidate('saag', { uses: ['spinach'] })],
			gaps.slice(0, 1),
			free
		);
		expect(picks[0]?.recipeId).toBe('saag');
	});

	it('prefers a recipe with fewer missing ingredients', () => {
		const picks = pickForGaps(
			[candidate('tacos', { missing: ['tortillas', 'lime'] }), candidate('dal')],
			gaps.slice(0, 1),
			free
		);
		expect(picks[0]?.recipeId).toBe('dal');
	});

	it('prefers the recipe closest to the calorie target', () => {
		const picks = pickForGaps(
			[candidate('heavy', { calories: 1100 }), candidate('light', { calories: 520 })],
			gaps.slice(0, 1),
			{ calorieTarget: 550, alreadyPlanned: [] }
		);
		expect(picks[0]?.recipeId).toBe('light');
	});

	it('ignores calories when nobody counts them', () => {
		const picks = pickForGaps(
			[candidate('heavy', { calories: 1100 }), candidate('light', { calories: 520 })],
			gaps.slice(0, 1),
			free
		);
		expect(picks[0]?.recipeId).toBe('heavy');
	});
});
