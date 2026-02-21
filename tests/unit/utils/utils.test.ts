import { describe, it, expect } from 'vitest';
import { formatCurrency, getCurrentSeason } from '../../../src/lib/utils';

describe('utils', () => {
	describe('formatCurrency', () => {
		it('should format number as USD by default', () => {
			const result = formatCurrency(10.5);
			expect(result).toBe('$10.50');
		});

		it('should format string number as USD', () => {
			const result = formatCurrency('10.5');
			expect(result).toBe('$10.50');
		});

		it('should format integer as USD', () => {
			const result = formatCurrency(10);
			expect(result).toBe('$10.00');
		});

		it('should handle zero', () => {
			const result = formatCurrency(0);
			expect(result).toBe('$0.00');
		});

		it('should return "0.00" for invalid string input', () => {
			const result = formatCurrency('abc');
			expect(result).toBe('0.00');
		});

		it('should return "0.00" for NaN', () => {
			const result = formatCurrency(NaN);
			expect(result).toBe('0.00');
		});

		it('should format as EUR', () => {
			const result = formatCurrency(10.5, 'EUR');
			expect(result).toBe('€10.50');
		});

		it('should format as GBP', () => {
			const result = formatCurrency(10.5, 'GBP');
			expect(result).toBe('£10.50');
		});

		it('should convert € symbol to EUR', () => {
			const result = formatCurrency(10.5, '€');
			expect(result).toBe('€10.50');
		});

		it('should convert $ symbol to USD', () => {
			const result = formatCurrency(10.5, '$');
			expect(result).toBe('$10.50');
		});

		it('should convert £ symbol to GBP', () => {
			const result = formatCurrency(10.5, '£');
			expect(result).toBe('£10.50');
		});

		it('should handle large numbers', () => {
			const result = formatCurrency(1234567.89);
			expect(result).toBe('$1,234,567.89');
		});

		it('should handle negative numbers', () => {
			const result = formatCurrency(-10.5);
			expect(result).toBe('-$10.50');
		});

		it('should fallback gracefully for invalid currency code', () => {
			const result = formatCurrency(10.5, 'INVALID');
			expect(result).toBe('INVALID 10.50');
		});
	});

	describe('getCurrentSeason', () => {
		it('should return spring for March', () => {
			expect(getCurrentSeason(new Date(2024, 2, 15))).toBe('spring');
		});

		it('should return spring for May', () => {
			expect(getCurrentSeason(new Date(2024, 4, 1))).toBe('spring');
		});

		it('should return summer for June', () => {
			expect(getCurrentSeason(new Date(2024, 5, 21))).toBe('summer');
		});

		it('should return summer for August', () => {
			expect(getCurrentSeason(new Date(2024, 7, 31))).toBe('summer');
		});

		it('should return autumn for September', () => {
			expect(getCurrentSeason(new Date(2024, 8, 1))).toBe('autumn');
		});

		it('should return autumn for November', () => {
			expect(getCurrentSeason(new Date(2024, 10, 30))).toBe('autumn');
		});

		it('should return winter for December', () => {
			expect(getCurrentSeason(new Date(2024, 11, 21))).toBe('winter');
		});

		it('should return winter for January', () => {
			expect(getCurrentSeason(new Date(2024, 0, 15))).toBe('winter');
		});

		it('should return winter for February', () => {
			expect(getCurrentSeason(new Date(2024, 1, 14))).toBe('winter');
		});

		it('should use the current date when no argument is provided', () => {
			const result = getCurrentSeason();
			expect(['spring', 'summer', 'autumn', 'winter']).toContain(result);
		});
	});
});
