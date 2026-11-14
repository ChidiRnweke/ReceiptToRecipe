import { describe, it, expect } from 'vitest';
import { canonicalItemKey, normalizeItemKey } from '../../../src/lib/services/kitchen';

describe('normalizeItemKey', () => {
	describe('treats spelling variants of one item as the same key', () => {
		it.each([
			['eggs', 'egg'],
			['Egg', 'egg'],
			['Tomatoes', 'tomato'],
			['potatoes', 'potato'],
			['mangoes', 'mango'],
			['berries', 'berry'],
			['Strawberries', 'strawberry'],
			['chillies', 'chilli'],
			['chilies', 'chili'],
			['cookies', 'cookie'],
			['pies', 'pie'],
			['peaches', 'peach'],
			['radishes', 'radish'],
			['boxes', 'box'],
			['glasses', 'glass'],
			['chickpeas', 'chickpea'],
			['peas', 'pea'],
			['cheeses', 'cheese'],
			['olives', 'olive'],
			['cloves', 'clove'],
			['bay leaves', 'bay leaf'],
			['quiches', 'quiche'],
			['kiwis', 'kiwi'],
			['cherry tomatoes', 'cherry tomato'],
			['  Baby   Spinach ', 'baby spinach'],
			['EGGS', 'egg'],
			['semi-skimmed milk', 'semi skimmed milk'],
			["Kellogg's Corn Flakes", 'kelloggs corn flake'],
			['crème fraîche', 'crème fraîche']
		])('%j becomes %j', (name, key) => {
			expect(normalizeItemKey(name)).toBe(key);
		});
	});

	describe('keeps words that are not plurals', () => {
		it.each([
			['hummus', 'hummus'],
			['couscous', 'couscous'],
			['asparagus', 'asparagus'],
			['swiss', 'swiss'],
			['molasses', 'molasses'],
			['haggis', 'haggis'],
			['sea bass', 'sea bass'],
			['citrus', 'citrus'],
			['gas', 'gas'],
			['rice', 'rice'],
			['milk', 'milk']
		])('%j stays %j', (name, key) => {
			expect(normalizeItemKey(name)).toBe(key);
		});
	});

	it('only makes the last word singular', () => {
		expect(normalizeItemKey('peas and carrots')).toBe('peas and carrot');
	});

	it('leaves a last word that contains a digit', () => {
		expect(normalizeItemKey('tomatoes 400s')).toBe('tomatoes 400s');
	});

	it('gives an empty key for a name with only punctuation', () => {
		expect(normalizeItemKey(' -- ')).toBe('');
	});

	it('is stable when applied to its own result', () => {
		expect(normalizeItemKey(normalizeItemKey('Cherry Tomatoes'))).toBe('cherry tomato');
	});
});

describe('canonicalItemKey', () => {
	it('keeps a leftover key as it is', () => {
		expect(canonicalItemKey('leftover:3f2a-Curry')).toBe('leftover:3f2a-Curry');
	});

	it('normalizes a product key', () => {
		expect(canonicalItemKey('Eggs')).toBe('egg');
	});
});
