import { describe, it, expect } from 'vitest';
import {
	calculateStockConfidencePure,
	calculateDepletionDatePure,
	getShelfLifePure
} from '../../../src/lib/services/pantryCalculations';
import { PantryService } from '../../../src/lib/services/PantryService';

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

describe('PantryService.calculateStockConfidenceWithOverrides', () => {
	const service = new PantryService();

	// Helper to create a date N days ago
	function daysAgo(n: number): Date {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d;
	}

	describe('without overrides (baseline)', () => {
		it('should return full confidence for item purchased today', () => {
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				new Date(),
				null,
				null,
				1
			);
			expect(confidence).toBe(1.0);
			expect(factors.lifespanSource).toBe('global_default');
		});

		it('should use avgFrequencyDays when available', () => {
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(5),
				10,
				null,
				1
			);
			// 1 - 5/10 = 0.5
			expect(confidence).toBeCloseTo(0.5, 1);
			expect(factors.lifespanSource).toBe('purchase_frequency');
			expect(factors.effectiveLifespanDays).toBe(10);
		});

		it('should fall back to category shelf life when no frequency', () => {
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(3),
				null,
				'dairy',
				1
			);
			// dairy = 10 days, 1 - 3/10 = 0.7
			expect(confidence).toBeCloseTo(0.7, 1);
			expect(factors.lifespanSource).toBe('category_default');
			expect(factors.effectiveLifespanDays).toBe(10);
		});

		it('should fall back to global default when no frequency or category', () => {
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(7),
				null,
				null,
				1
			);
			// global default = 14 days, 1 - 7/14 = 0.5
			expect(confidence).toBeCloseTo(0.5, 1);
			expect(factors.lifespanSource).toBe('global_default');
			expect(factors.effectiveLifespanDays).toBe(14);
		});
	});

	describe('with user override date', () => {
		it('should use override date instead of purchase date', () => {
			// Purchased 10 days ago, but user confirmed 2 days ago
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(10),
				14,
				null,
				1,
				{ userOverrideDate: daysAgo(2) }
			);
			// Uses override date: 1 - 2/14 ≈ 0.857
			expect(confidence).toBeCloseTo(0.857, 2);
			expect(factors.effectiveDate).toEqual(daysAgo(2));
		});

		it('should give full confidence when override date is today', () => {
			const { confidence } = service.calculateStockConfidenceWithOverrides(
				daysAgo(30),
				14,
				null,
				1,
				{ userOverrideDate: new Date() }
			);
			expect(confidence).toBe(1.0);
		});
	});

	describe('with user shelf life override', () => {
		it('should use override shelf life instead of category default', () => {
			// Category says 7 days (produce), but user says 21 days
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(7),
				null,
				'produce',
				1,
				{ userShelfLifeDays: 21 }
			);
			// 1 - 7/21 = 0.667
			expect(confidence).toBeCloseTo(0.667, 2);
			expect(factors.lifespanSource).toBe('user_override');
			expect(factors.effectiveLifespanDays).toBe(21);
		});

		it('should use override shelf life instead of purchase frequency', () => {
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(5),
				10,
				'produce',
				1,
				{ userShelfLifeDays: 30 }
			);
			// 1 - 5/30 = 0.833
			expect(confidence).toBeCloseTo(0.833, 2);
			expect(factors.lifespanSource).toBe('user_override');
		});
	});

	describe('with user quantity override', () => {
		it('should use override quantity for confidence boost', () => {
			const { confidence: withOverride, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(7),
				14,
				null,
				1,
				{
					userQuantityOverride: 5
				}
			);

			const { confidence: withoutOverride } = service.calculateStockConfidenceWithOverrides(
				daysAgo(7),
				14,
				null,
				1,
				{}
			);

			// Override quantity of 5 should boost confidence vs default 1
			expect(withOverride).toBeGreaterThan(withoutOverride);
			expect(factors.effectiveQuantity).toBe(5);
			expect(factors.quantityBoost).toBeCloseTo(Math.log(5) * 0.1, 4);
		});
	});

	describe('with combined overrides', () => {
		it('should apply all overrides together', () => {
			const { confidence, factors } = service.calculateStockConfidenceWithOverrides(
				daysAgo(30), // original purchase was 30 days ago
				7, // frequency says 7 days
				'produce', // category says 7 days
				1, // original quantity
				{
					userOverrideDate: daysAgo(2), // confirmed 2 days ago
					userShelfLifeDays: 14, // user says lasts 14 days
					userQuantityOverride: 3 // user says they have 3
				}
			);

			// effective date = 2 days ago, lifespan = 14, quantity = 3
			// base = 1 - 2/14 = 0.857
			// boost = log(3) * 0.1 = 0.1099
			// total = min(1, 0.857 + 0.1099) = 0.967
			expect(confidence).toBeCloseTo(0.967, 2);
			expect(factors.lifespanSource).toBe('user_override');
			expect(factors.effectiveLifespanDays).toBe(14);
			expect(factors.effectiveQuantity).toBe(3);
			expect(factors.baseConfidence).toBeCloseTo(0.857, 2);
		});
	});

	describe('confidence factors transparency', () => {
		it('should include all required factor fields', () => {
			const { factors } = service.calculateStockConfidenceWithOverrides(daysAgo(5), 10, 'dairy', 2);

			expect(factors).toHaveProperty('effectiveDate');
			expect(factors).toHaveProperty('effectiveLifespanDays');
			expect(factors).toHaveProperty('lifespanSource');
			expect(factors).toHaveProperty('effectiveQuantity');
			expect(factors).toHaveProperty('quantityBoost');
			expect(factors).toHaveProperty('baseConfidence');
		});

		it('should calculate baseConfidence without quantity boost', () => {
			const { factors } = service.calculateStockConfidenceWithOverrides(daysAgo(5), 10, null, 3);

			// baseConfidence should be raw linear decay without boost
			expect(factors.baseConfidence).toBeCloseTo(0.5, 1);
			// quantityBoost should be separate
			expect(factors.quantityBoost).toBeCloseTo(Math.log(3) * 0.1, 4);
		});

		it('should have zero quantity boost for quantity of 1', () => {
			const { factors } = service.calculateStockConfidenceWithOverrides(daysAgo(5), 10, null, 1);
			expect(factors.quantityBoost).toBe(0);
		});
	});
});
