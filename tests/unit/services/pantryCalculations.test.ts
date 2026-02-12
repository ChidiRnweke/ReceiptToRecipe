import { describe, it, expect } from 'vitest';
import { 
	calculateStockConfidencePure, 
	calculateDepletionDatePure, 
	getShelfLifePure 
} from '../../../src/lib/services/pantryCalculations';

describe('pantryCalculations', () => {
	describe('calculateStockConfidencePure', () => {
		it('should return 1.0 at day 0', () => {
			const result = calculateStockConfidencePure(0, 14, 1);
			expect(result).toBe(1.0);
		});

		it('should return 1.0 for negative days (future purchase)', () => {
			const result = calculateStockConfidencePure(-1, 14, 1);
			expect(result).toBe(1.0);
		});

		it('should return 0.5 at 50% of lifespan', () => {
			const result = calculateStockConfidencePure(7, 14, 1);
			expect(result).toBe(0.5);
		});

		it('should return 0.0 at 100% of lifespan', () => {
			const result = calculateStockConfidencePure(14, 14, 1);
			expect(result).toBe(0.0);
		});

		it('should be clamped at 0.0 when exceeding lifespan', () => {
			const result = calculateStockConfidencePure(28, 14, 1);
			expect(result).toBe(0.0);
		});

		it('should boost confidence for quantity > 1', () => {
			const resultWithQuantity = calculateStockConfidencePure(7, 14, 5);
			const resultWithoutQuantity = calculateStockConfidencePure(7, 14, 1);
			expect(resultWithQuantity).toBeGreaterThan(resultWithoutQuantity);
		});

		it('should calculate quantity boost correctly', () => {
			const result = calculateStockConfidencePure(7, 14, 10);
			// 0.5 base + log(10)*0.1 = 0.5 + 2.302*0.1 = 0.5 + 0.23 = 0.73
			expect(result).toBeCloseTo(0.73, 2);
		});

		it('should be clamped at 1.0 even with high quantity', () => {
			const result = calculateStockConfidencePure(0, 14, 100);
			expect(result).toBe(1.0);
		});

		it('should handle very short lifespans', () => {
			const result = calculateStockConfidencePure(1, 3, 1);
			// 1 - 1/3 = 0.67
			expect(result).toBeCloseTo(0.67, 2);
		});

		it('should handle very long lifespans', () => {
			const result = calculateStockConfidencePure(30, 365, 1);
			// 1 - 30/365 = 0.918
			expect(result).toBeCloseTo(0.918, 2);
		});
	});

	describe('calculateDepletionDatePure', () => {
		it('should calculate depletion date correctly', () => {
			const lastPurchased = new Date('2024-01-01');
			const result = calculateDepletionDatePure(lastPurchased, 7);
			expect(result).toEqual(new Date('2024-01-08'));
		});

		it('should handle month boundaries', () => {
			const lastPurchased = new Date('2024-01-25');
			const result = calculateDepletionDatePure(lastPurchased, 10);
			expect(result).toEqual(new Date('2024-02-04'));
		});

		it('should handle year boundaries', () => {
			const lastPurchased = new Date('2024-12-25');
			const result = calculateDepletionDatePure(lastPurchased, 14);
			expect(result).toEqual(new Date('2025-01-08'));
		});

		it('should handle zero lifespan', () => {
			const lastPurchased = new Date('2024-01-01');
			const result = calculateDepletionDatePure(lastPurchased, 0);
			expect(result).toEqual(new Date('2024-01-01'));
		});

		it('should handle leap year', () => {
			const lastPurchased = new Date('2024-02-28');
			const result = calculateDepletionDatePure(lastPurchased, 2);
			expect(result).toEqual(new Date('2024-03-01'));
		});
	});

	describe('getShelfLifePure', () => {
		it('should return 14 for null category', () => {
			expect(getShelfLifePure(null)).toBe(14);
		});

		it('should return 14 for empty category', () => {
			expect(getShelfLifePure('')).toBe(14);
		});

		describe('explicit categories', () => {
			it('should return 7 for produce', () => {
				expect(getShelfLifePure('produce')).toBe(7);
			});

			it('should return 10 for dairy', () => {
				expect(getShelfLifePure('dairy')).toBe(10);
			});

			it('should return 5 for meat', () => {
				expect(getShelfLifePure('meat')).toBe(5);
			});

			it('should return 3 for seafood', () => {
				expect(getShelfLifePure('seafood')).toBe(3);
			});

			it('should return 90 for pantry', () => {
				expect(getShelfLifePure('pantry')).toBe(90);
			});

			it('should return 60 for frozen', () => {
				expect(getShelfLifePure('frozen')).toBe(60);
			});

			it('should return 365 for canned', () => {
				expect(getShelfLifePure('canned')).toBe(365);
			});

			it('should return 4 for bakery', () => {
				expect(getShelfLifePure('bakery')).toBe(4);
			});

			it('should return 180 for beverages', () => {
				expect(getShelfLifePure('beverages')).toBe(180);
			});

			it('should return 60 for snacks', () => {
				expect(getShelfLifePure('snacks')).toBe(60);
			});

			it('should return 730 for household', () => {
				expect(getShelfLifePure('household')).toBe(730);
			});

			it('should return 14 for other', () => {
				expect(getShelfLifePure('other')).toBe(14);
			});
		});

		describe('case insensitivity', () => {
			it('should handle PRODUCE', () => {
				expect(getShelfLifePure('PRODUCE')).toBe(7);
			});

			it('should handle Produce', () => {
				expect(getShelfLifePure('Produce')).toBe(7);
			});
		});

		describe('fuzzy matches', () => {
			it('should return 7 for vegetable', () => {
				expect(getShelfLifePure('vegetable')).toBe(7);
			});

			it('should return 7 for vegetables', () => {
				expect(getShelfLifePure('vegetables')).toBe(7);
			});

			it('should return 7 for fruit', () => {
				expect(getShelfLifePure('fruit')).toBe(7);
			});

			it('should return 10 for milk', () => {
				expect(getShelfLifePure('milk')).toBe(10);
			});

			it('should return 10 for yogurt', () => {
				expect(getShelfLifePure('yogurt')).toBe(10);
			});

			it('should return 10 for cheese', () => {
				expect(getShelfLifePure('cheese')).toBe(10);
			});

			it('should return 5 for chicken', () => {
				expect(getShelfLifePure('chicken')).toBe(5);
			});

			it('should return 5 for fish', () => {
				expect(getShelfLifePure('fish')).toBe(5);
			});

			it('should return 4 for bread', () => {
				expect(getShelfLifePure('bread')).toBe(4);
			});
		});

		describe('unknown categories', () => {
			it('should return 14 for unknown category', () => {
				expect(getShelfLifePure('unknown')).toBe(14);
			});

			it('should return 14 for xyz', () => {
				expect(getShelfLifePure('xyz')).toBe(14);
			});
		});
	});
});
