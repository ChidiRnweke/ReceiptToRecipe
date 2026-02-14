/// <reference types="vitest/globals" />
import { describeLLM, OPENROUTER_API_KEY, CHEAP_CHAT_MODEL, withRetry } from './setup';
import { SmartProductNormalizer } from '../../src/lib/services/SmartProductNormalizer';

describeLLM('SmartProductNormalizer (LLM Integration)', () => {
	let service: SmartProductNormalizer;

	beforeAll(() => {
		service = new SmartProductNormalizer(OPENROUTER_API_KEY, CHEAP_CHAT_MODEL);
	});

	describe('normalizeProduct', () => {
		it('should normalize a branded soda product', async () => {
			const result = await withRetry(() => service.normalizeProduct('Coca Cola Zero 33cl'));

			expect(result).toHaveProperty('normalizedName');
			expect(result).toHaveProperty('productGroup');
			expect(result).toHaveProperty('category');

			expect(typeof result.normalizedName).toBe('string');
			expect(result.normalizedName.length).toBeGreaterThan(0);
			// Should not be the fallback value
			expect(result.category.toLowerCase()).not.toBe('other');
			expect(result.category.toLowerCase()).toMatch(/beverage|drink/);
		});

		it('should normalize a fresh produce item', async () => {
			const result = await withRetry(() => service.normalizeProduct('Organic Gala Apples 1kg'));

			expect(result.normalizedName.toLowerCase()).toContain('apple');
			expect(result.category.toLowerCase()).toMatch(/produce|fruit/);
		});

		it('should normalize a dairy product', async () => {
			const result = await withRetry(() => service.normalizeProduct('Arla Full Fat Milk 1L'));

			expect(result.normalizedName.toLowerCase()).toMatch(/milk/);
			expect(result.category.toLowerCase()).toMatch(/dairy/);
		});

		it('should normalize a snack product', async () => {
			const result = await withRetry(() =>
				service.normalizeProduct('Lays Classic Potato Chips 150g')
			);

			expect(result.normalizedName.toLowerCase()).toMatch(/chip|crisp/);
			expect(result.category.toLowerCase()).toMatch(/snack|pantry/);
		});

		it('should normalize a meat product', async () => {
			const result = await withRetry(() =>
				service.normalizeProduct('USDA Choice Beef Sirloin Steak 500g')
			);

			const normalized = result.normalizedName.toLowerCase();
			expect(normalized).toMatch(/beef|steak|sirloin/);
			expect(result.category.toLowerCase()).toMatch(/meat|protein/);
		});

		it('should normalize a bakery item', async () => {
			const result = await withRetry(() =>
				service.normalizeProduct('Wonder White Bread Sliced 500g')
			);

			expect(result.normalizedName.toLowerCase()).toMatch(/bread/);
			expect(result.category.toLowerCase()).toMatch(/bakery|bread|pantry|grain/);
		});

		it('should handle ambiguous receipt shorthand', async () => {
			const result = await withRetry(() => service.normalizeProduct('ORG BAN 1.2KG'));

			// Should attempt to interpret this as organic bananas
			expect(result).toHaveProperty('normalizedName');
			expect(result).toHaveProperty('category');
			expect(typeof result.normalizedName).toBe('string');
		});

		it('should return consistent structure for unknown products', async () => {
			const result = await withRetry(() => service.normalizeProduct('MISC ITEM 12345'));

			expect(result).toHaveProperty('normalizedName');
			expect(result).toHaveProperty('productGroup');
			expect(result).toHaveProperty('category');
			expect(typeof result.normalizedName).toBe('string');
			expect(typeof result.productGroup).toBe('string');
			expect(typeof result.category).toBe('string');
		});

		it('should normalize multiple items consistently', async () => {
			const [result1, result2] = await Promise.all([
				withRetry(() => service.normalizeProduct('Fresh Salmon Fillet 200g')),
				withRetry(() => service.normalizeProduct('Atlantic Salmon 250g'))
			]);

			// Both should identify salmon
			expect(result1.normalizedName.toLowerCase()).toMatch(/salmon/);
			expect(result2.normalizedName.toLowerCase()).toMatch(/salmon/);

			// Categories should match
			expect(result1.category.toLowerCase()).toBe(result2.category.toLowerCase());
		});
	});
});
