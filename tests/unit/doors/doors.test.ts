import { describe, it, expect } from 'vitest';
import { DOORS, activeDoor } from '../../../src/lib/components/doors/doors';

describe('the door bar', () => {
	it('shows the five doors in a fixed order', () => {
		expect(DOORS.map((door) => door.label)).toEqual([
			'Tonight',
			'Plan',
			'Shop',
			'Recipes',
			'Use it up'
		]);
	});

	it('opens Tonight on the home page', () => {
		expect(activeDoor('/')).toBe('tonight');
	});

	it('lights Tonight on its own page', () => {
		expect(activeDoor('/tonight')).toBe('tonight');
	});

	it('links Tonight to its own page', () => {
		expect(DOORS[0].href).toBe('/tonight');
	});

	it('does not light Tonight on another page', () => {
		expect(activeDoor('/preferences')).toBeNull();
	});

	it('lights Recipes on a single recipe', () => {
		expect(activeDoor('/recipes/abc-123')).toBe('recipes');
	});

	it('lights Use it up on the cupboard', () => {
		expect(activeDoor('/cupboard')).toBe('use');
	});

	it('lights Shop on the shopping list', () => {
		expect(activeDoor('/shopping')).toBe('shop');
	});

	it('lights Plan on the planner', () => {
		expect(activeDoor('/plan')).toBe('plan');
	});

	it('does not light Recipes for a path that only starts with the same letters', () => {
		expect(activeDoor('/recipesx')).toBeNull();
	});
});
