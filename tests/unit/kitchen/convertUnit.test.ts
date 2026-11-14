import { describe, it, expect } from 'vitest';
import { convertUnit, toBaseUnit } from '../../../src/lib/services/kitchen';

describe('convertUnit', () => {
	it('converts kilograms to grams', () => {
		expect(convertUnit(1.5, 'kg', 'g')).toBe(1500);
	});

	it('converts litres to millilitres', () => {
		expect(convertUnit(2, 'l', 'ml')).toBe(2000);
	});

	it('converts tablespoons to millilitres at 15 ml each', () => {
		expect(convertUnit(2, 'tbsp', 'ml')).toBe(30);
	});

	it('converts teaspoons to millilitres at 5 ml each', () => {
		expect(convertUnit(3, 'tsp', 'ml')).toBe(15);
	});

	it('converts cups to millilitres at 240 ml each', () => {
		expect(convertUnit(1, 'cup', 'ml')).toBe(240);
	});

	it('counts cloves as items', () => {
		expect(convertUnit(3, 'cloves', 'count')).toBe(3);
	});

	it('reads unit names regardless of case', () => {
		expect(convertUnit(1, 'KG', 'g')).toBe(1000);
	});

	it('returns null between mass and volume', () => {
		expect(convertUnit(100, 'g', 'ml')).toBeNull();
	});

	it('returns null for a unit it does not know', () => {
		expect(convertUnit(1, 'handful', 'g')).toBeNull();
	});
});

describe('toBaseUnit', () => {
	it('expresses cups in millilitres', () => {
		expect(toBaseUnit(0.5, 'cup')).toEqual({ quantity: 120, unit: 'ml' });
	});

	it('returns null for a unit it does not know', () => {
		expect(toBaseUnit(1, 'pinch')).toBeNull();
	});
});
