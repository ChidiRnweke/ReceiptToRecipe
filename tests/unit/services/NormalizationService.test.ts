import { describe, it, expect } from 'vitest';
import { NormalizationService } from '../../../src/lib/services/NormalizationService';

describe('NormalizationService', () => {
  const service = new NormalizationService();

  describe('normalizeQuantity', () => {
    describe('weight units', () => {
      it('should convert grams to grams', () => {
        const result = service.normalizeQuantity('500 g');
        expect(result.value).toBe(500);
        expect(result.unit).toBe('g');
        expect(result.unitType).toBe('WEIGHT');
      });

      it('should convert kilograms to grams', () => {
        const result = service.normalizeQuantity('2 kg');
        expect(result.value).toBe(2000);
        expect(result.unit).toBe('g');
        expect(result.unitType).toBe('WEIGHT');
      });

      it('should convert ounces to grams', () => {
        const result = service.normalizeQuantity('8 oz');
        expect(result.value).toBeCloseTo(226.796, 1);
        expect(result.unit).toBe('g');
        expect(result.unitType).toBe('WEIGHT');
      });

      it('should convert pounds to grams', () => {
        const result = service.normalizeQuantity('1 lb');
        expect(result.value).toBeCloseTo(453.592, 1);
        expect(result.unit).toBe('g');
        expect(result.unitType).toBe('WEIGHT');
      });

      it('should convert milligrams to grams', () => {
        const result = service.normalizeQuantity('500 mg');
        expect(result.value).toBe(0.5);
        expect(result.unit).toBe('g');
        expect(result.unitType).toBe('WEIGHT');
      });
    });

    describe('volume units', () => {
      it('should convert milliliters to milliliters', () => {
        const result = service.normalizeQuantity('250 ml');
        expect(result.value).toBe(250);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert liters to milliliters', () => {
        const result = service.normalizeQuantity('2 l');
        expect(result.value).toBe(2000);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert cups to milliliters', () => {
        const result = service.normalizeQuantity('1 cup');
        expect(result.value).toBeCloseTo(236.588, 1);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert tablespoons to milliliters', () => {
        const result = service.normalizeQuantity('2 tbsp');
        expect(result.value).toBeCloseTo(29.574, 1);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert teaspoons to milliliters', () => {
        const result = service.normalizeQuantity('3 tsp');
        expect(result.value).toBeCloseTo(14.787, 1);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert fluid ounces to milliliters', () => {
        const result = service.normalizeQuantity('8 fl oz');
        expect(result.value).toBeCloseTo(236.588, 1);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert pints to milliliters', () => {
        const result = service.normalizeQuantity('1 pint');
        expect(result.value).toBeCloseTo(473.176, 1);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert quarts to milliliters', () => {
        const result = service.normalizeQuantity('1 quart');
        expect(result.value).toBeCloseTo(946.353, 1);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });

      it('should convert gallons to milliliters', () => {
        const result = service.normalizeQuantity('1 gallon');
        expect(result.value).toBeCloseTo(3785.41, 0);
        expect(result.unit).toBe('ml');
        expect(result.unitType).toBe('VOLUME');
      });
    });

    describe('count units', () => {
      it('should handle count without unit', () => {
        const result = service.normalizeQuantity('5');
        expect(result.value).toBe(5);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle count with "count" unit', () => {
        const result = service.normalizeQuantity('3 count');
        expect(result.value).toBe(3);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle pieces', () => {
        const result = service.normalizeQuantity('6 pieces');
        expect(result.value).toBe(6);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle dozens', () => {
        const result = service.normalizeQuantity('2 dozen');
        expect(result.value).toBe(24);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle cans', () => {
        const result = service.normalizeQuantity('4 cans');
        expect(result.value).toBe(4);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle bunches', () => {
        const result = service.normalizeQuantity('3 bunches');
        expect(result.value).toBe(3);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });
    });

    describe('fractions', () => {
      it('should handle simple fraction', () => {
        const result = service.normalizeQuantity('1/2 cup');
        expect(result.value).toBeCloseTo(118.294, 1);
        expect(result.unit).toBe('ml');
      });

      it('should handle mixed number with fraction', () => {
        const result = service.normalizeQuantity('1 1/2 cups');
        expect(result.value).toBeCloseTo(354.882, 1);
        expect(result.unit).toBe('ml');
      });

      it('should handle fraction alone', () => {
        const result = service.normalizeQuantity('3/4');
        expect(result.value).toBe(0.75);
        expect(result.unit).toBe('count');
      });
    });

    describe('decimals', () => {
      it('should handle decimal with period', () => {
        const result = service.normalizeQuantity('1.5 kg');
        expect(result.value).toBe(1500);
        expect(result.unit).toBe('g');
      });

      it('should handle decimal with comma', () => {
        const result = service.normalizeQuantity('1,5 kg');
        expect(result.value).toBe(1500);
        expect(result.unit).toBe('g');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string as count of 1', () => {
        const result = service.normalizeQuantity('');
        expect(result.value).toBe(1);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle null as count of 1', () => {
        const result = service.normalizeQuantity(null as any);
        expect(result.value).toBe(1);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle unknown unit as count', () => {
        const result = service.normalizeQuantity('5 unknown');
        expect(result.value).toBe(5);
        expect(result.unit).toBe('count');
        expect(result.unitType).toBe('COUNT');
      });

      it('should handle whitespace', () => {
        const result = service.normalizeQuantity('  100   g  ');
        expect(result.value).toBe(100);
        expect(result.unit).toBe('g');
      });

      it('should preserve original value', () => {
        const result = service.normalizeQuantity('500 g');
        expect(result.originalValue).toBe('500 g');
      });

      it('should handle thousands separators (comma)', () => {
        const result = service.normalizeQuantity('1,234 g');
        expect(result.value).toBe(1234);
        expect(result.unit).toBe('g');
      });

      it('should handle thousands separators with decimal (1,234.56)', () => {
        const result = service.normalizeQuantity('1,234.56 g');
        expect(result.value).toBe(1234.56);
        expect(result.unit).toBe('g');
      });

      it('should handle multiple thousands separators (1,234,567)', () => {
        const result = service.normalizeQuantity('1,234,567 g');
        expect(result.value).toBe(1234567);
      });

      it('should handle negative numbers', () => {
        const result = service.normalizeQuantity('-5 g');
        expect(result.value).toBe(-5);
        expect(result.unit).toBe('g');
      });

      it('should convert dozen to 12x count', () => {
        const result = service.normalizeQuantity('2 dozen');
        expect(result.value).toBe(24);
        expect(result.unit).toBe('count');
      });

      it('should convert doz to 12x count', () => {
        const result = service.normalizeQuantity('1 doz');
        expect(result.value).toBe(12);
        expect(result.unit).toBe('count');
      });
    });
  });

  describe('normalizeName', () => {
    it('should lowercase names', () => {
      expect(service.normalizeName('MILK')).toBe('milk');
    });

    it('should trim whitespace', () => {
      expect(service.normalizeName('  milk  ')).toBe('milk');
    });

    it('should collapse multiple spaces', () => {
      expect(service.normalizeName('semi   skimmed   milk')).toBe('semi skimmed milk');
    });

    it('should remove special characters', () => {
      expect(service.normalizeName('milk! @#')).toBe('milk');
    });

    it('should keep hyphens', () => {
      expect(service.normalizeName('semi-skimmed milk')).toBe('semi-skimmed milk');
    });

    it('should remove common modifiers', () => {
      expect(service.normalizeName('organic fresh milk')).toBe('milk');
    });

    it('should remove modifiers in the middle without leaving double spaces', () => {
      expect(service.normalizeName('peas frozen and carrots')).toBe('peas and carrots');
    });

    it('should handle frozen modifier', () => {
      expect(service.normalizeName('frozen peas')).toBe('peas');
    });

    it('should handle canned modifier', () => {
      expect(service.normalizeName('canned tomatoes')).toBe('tomatoes');
    });

    it('should handle dried modifier', () => {
      expect(service.normalizeName('dried fruit')).toBe('fruit');
    });

    it('should handle empty string', () => {
      expect(service.normalizeName('')).toBe('');
    });

    it('should handle null', () => {
      expect(service.normalizeName(null as any)).toBe('');
    });
  });

  describe('areComparable', () => {
    it('should return true for same unit types', () => {
      const qty1 = service.normalizeQuantity('100 g');
      const qty2 = service.normalizeQuantity('200 g');
      expect(service.areComparable(qty1, qty2)).toBe(true);
    });

    it('should return false for different unit types', () => {
      const qty1 = service.normalizeQuantity('100 g');
      const qty2 = service.normalizeQuantity('200 ml');
      expect(service.areComparable(qty1, qty2)).toBe(false);
    });

    it('should return true for both count types', () => {
      const qty1 = service.normalizeQuantity('5');
      const qty2 = service.normalizeQuantity('3 pieces');
      expect(service.areComparable(qty1, qty2)).toBe(true);
    });
  });

  describe('add', () => {
    it('should add quantities of same type', () => {
      const qty1 = service.normalizeQuantity('100 g');
      const qty2 = service.normalizeQuantity('200 g');
      const result = service.add(qty1, qty2);
      expect(result.value).toBe(300);
      expect(result.unit).toBe('g');
      expect(result.unitType).toBe('WEIGHT');
    });

    it('should throw error for different unit types', () => {
      const qty1 = service.normalizeQuantity('100 g');
      const qty2 = service.normalizeQuantity('200 ml');
      expect(() => service.add(qty1, qty2)).toThrow('Cannot add quantities of different types');
    });

    it('should add count quantities', () => {
      const qty1 = service.normalizeQuantity('5');
      const qty2 = service.normalizeQuantity('3');
      const result = service.add(qty1, qty2);
      expect(result.value).toBe(8);
      expect(result.unit).toBe('count');
    });
  });

  describe('scale', () => {
    it('should scale quantity up', () => {
      const qty = service.normalizeQuantity('100 g');
      const result = service.scale(qty, 2);
      expect(result.value).toBe(200);
      expect(result.unit).toBe('g');
    });

    it('should scale quantity down', () => {
      const qty = service.normalizeQuantity('100 g');
      const result = service.scale(qty, 0.5);
      expect(result.value).toBe(50);
      expect(result.unit).toBe('g');
    });

    it('should scale volume quantities', () => {
      const qty = service.normalizeQuantity('250 ml');
      const result = service.scale(qty, 3);
      expect(result.value).toBe(750);
      expect(result.unit).toBe('ml');
    });
  });

  describe('toDisplayString', () => {
    it('should display weight under 1000g in grams', () => {
      const qty = service.normalizeQuantity('500 g');
      expect(service.toDisplayString(qty)).toBe('500g');
    });

    it('should display weight over 1000g in kg', () => {
      const qty = service.normalizeQuantity('1500 g');
      expect(service.toDisplayString(qty)).toBe('1.5kg');
    });

    it('should display volume under 1000ml in milliliters', () => {
      const qty = service.normalizeQuantity('250 ml');
      expect(service.toDisplayString(qty)).toBe('250ml');
    });

    it('should display volume over 1000ml in liters', () => {
      const qty = service.normalizeQuantity('1500 ml');
      expect(service.toDisplayString(qty)).toBe('1.5L');
    });

    it('should display count as whole number', () => {
      const qty = service.normalizeQuantity('5');
      expect(service.toDisplayString(qty)).toBe('5');
    });

    it('should display count with decimal when needed', () => {
      const qty = service.normalizeQuantity('5.5');
      expect(service.toDisplayString(qty)).toBe('5.5');
    });
  });
});
