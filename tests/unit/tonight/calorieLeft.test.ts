import { describe, it, expect } from 'vitest';
import { calorieLeft } from '../../../src/lib/services/tonight';

describe('calorieLeft', () => {
	it('subtracts what was eaten today from the goal', () => {
		expect(calorieLeft(2000, 1240)).toBe(760);
	});

	it('never goes below zero', () => {
		expect(calorieLeft(1800, 2100)).toBe(0);
	});

	it('is null without a goal', () => {
		expect(calorieLeft(null, 500)).toBeNull();
	});
});
