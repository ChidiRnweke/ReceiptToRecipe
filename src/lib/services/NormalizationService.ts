import type { INormalizationService, NormalizedQuantity, UnitType } from './interfaces';

// Weight conversions to grams
const WEIGHT_TO_GRAMS: Record<string, number> = {
	g: 1,
	gram: 1,
	grams: 1,
	kg: 1000,
	kilogram: 1000,
	kilograms: 1000,
	oz: 28.3495,
	ounce: 28.3495,
	ounces: 28.3495,
	lb: 453.592,
	lbs: 453.592,
	pound: 453.592,
	pounds: 453.592,
	mg: 0.001,
	milligram: 0.001,
	milligrams: 0.001
};

// Volume conversions to milliliters
const VOLUME_TO_ML: Record<string, number> = {
	ml: 1,
	milliliter: 1,
	milliliters: 1,
	l: 1000,
	liter: 1000,
	liters: 1000,
	litre: 1000,
	litres: 1000,
	cup: 236.588,
	cups: 236.588,
	tbsp: 14.787,
	tablespoon: 14.787,
	tablespoons: 14.787,
	tsp: 4.929,
	teaspoon: 4.929,
	teaspoons: 4.929,
	'fl oz': 29.5735,
	'fluid ounce': 29.5735,
	'fluid ounces': 29.5735,
	floz: 29.5735,
	pint: 473.176,
	pints: 473.176,
	pt: 473.176,
	quart: 946.353,
	quarts: 946.353,
	qt: 946.353,
	gallon: 3785.41,
	gallons: 3785.41,
	gal: 3785.41
};

// Count units (no conversion needed)
const COUNT_UNITS = new Set([
	'count',
	'piece',
	'pieces',
	'pcs',
	'pc',
	'unit',
	'units',
	'each',
	'ea',
	'item',
	'items',
	'bunch',
	'bunches',
	'head',
	'heads',
	'clove',
	'cloves',
	'slice',
	'slices',
	'can',
	'cans',
	'bottle',
	'bottles',
	'jar',
	'jars',
	'pack',
	'packs',
	'package',
	'packages',
	'bag',
	'bags',
	'box',
	'boxes',
	'dozen',
	'doz'
]);

export class NormalizationService implements INormalizationService {
	normalizeQuantity(rawQuantity: string): NormalizedQuantity {
		const raw = String(rawQuantity ?? '');
		const cleaned = raw.toLowerCase().trim();
		const original = raw;

		// Pattern to match number (including fractions) and unit
		const pattern = /^([-]?[\d.,/\s]+)\s*(.*)$/;
		const match = cleaned.match(pattern);

		if (!match) {
			// No number found, assume count of 1
			return {
				value: 1,
				unit: 'count',
				unitType: 'COUNT',
				originalValue: original
			};
		}

		const [, numStr, unitStr] = match;
		const value = this.parseNumber(numStr);
		const unit = String(unitStr ?? '').trim() || 'count';

		// Try to identify unit type and convert
		const unitLower = unit.toLowerCase();

		// Handle dozen
		if (unitLower === 'dozen' || unitLower === 'doz') {
			return {
				value: value * 12,
				unit: 'count',
				unitType: 'COUNT',
				originalValue: original
			};
		}

		// Check weight
		if (WEIGHT_TO_GRAMS[unitLower] !== undefined) {
			return {
				value: value * WEIGHT_TO_GRAMS[unitLower],
				unit: 'g',
				unitType: 'WEIGHT',
				originalValue: original
			};
		}

		// Check volume
		if (VOLUME_TO_ML[unitLower] !== undefined) {
			return {
				value: value * VOLUME_TO_ML[unitLower],
				unit: 'ml',
				unitType: 'VOLUME',
				originalValue: original
			};
		}

		// Check count
		if (COUNT_UNITS.has(unitLower) || unitLower === '') {
			return {
				value,
				unit: 'count',
				unitType: 'COUNT',
				originalValue: original
			};
		}

		// Unknown unit, treat as count
		return {
			value,
			unit: 'count',
			unitType: 'COUNT',
			originalValue: original
		};
	}

	normalizeName(rawName: string): string {
		const name = String(rawName ?? '');
		return name
			.toLowerCase()
			.trim()
			.replace(/\b(organic|fresh|frozen|canned|dried)\b/gi, '') // Remove common modifiers
			.replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
			.replace(/\s+/g, ' ') // Collapse multiple spaces
			.trim();
	}

	areComparable(qty1: NormalizedQuantity, qty2: NormalizedQuantity): boolean {
		return qty1.unitType === qty2.unitType;
	}

	add(qty1: NormalizedQuantity, qty2: NormalizedQuantity): NormalizedQuantity {
		if (!this.areComparable(qty1, qty2)) {
			throw new Error(
				`Cannot add quantities of different types: ${qty1.unitType} and ${qty2.unitType}`
			);
		}

		return {
			value: qty1.value + qty2.value,
			unit: qty1.unit,
			unitType: qty1.unitType,
			originalValue: `${qty1.originalValue} + ${qty2.originalValue}`
		};
	}

	scale(qty: NormalizedQuantity, factor: number): NormalizedQuantity {
		return {
			value: qty.value * factor,
			unit: qty.unit,
			unitType: qty.unitType,
			originalValue: `${qty.originalValue} × ${factor}`
		};
	}

	toDisplayString(qty: NormalizedQuantity): string {
		const value = qty.value;

		if (qty.unitType === 'WEIGHT') {
			if (value >= 1000) {
				return `${(value / 1000).toFixed(1)}kg`;
			}
			return `${Math.round(value)}g`;
		}

		if (qty.unitType === 'VOLUME') {
			if (value >= 1000) {
				return `${(value / 1000).toFixed(1)}L`;
			}
			return `${Math.round(value)}ml`;
		}

		// COUNT
		if (value === Math.floor(value)) {
			return `${value}`;
		}
		return `${value.toFixed(1)}`;
	}

	private parseNumber(numStr: string): number {
		const cleaned = numStr.trim();

		// Handle fractions like "1/2" or "1 1/2"
		if (cleaned.includes('/')) {
			const parts = cleaned.split(/\s+/);
			let total = 0;

			for (const part of parts) {
				if (part.includes('/')) {
					const [num, denom] = part.split('/').map(Number);
					if (denom !== 0) {
						total += num / denom;
					}
				} else {
					const n = parseFloat(part);
					if (!isNaN(n)) {
						total += n;
					}
				}
			}

			return total || 1;
		}

		// Handle regular numbers
		let numberStr = cleaned;

		// Heuristic for thousands separators vs decimal comma
		if (numberStr.includes(',') && numberStr.includes('.')) {
			// If both present, comma is likely thousands separator (US/UK) or dot is thousands (EU)
			// Assuming US/UK default: 1,234.56 -> remove comma
			// If 1.234,56 (EU) -> convert dot to empty, comma to dot?
			// Let's assume standard US/UK preference for now but handle the mix
			if (numberStr.indexOf(',') < numberStr.indexOf('.')) {
				// 1,234.56 -> remove comma
				numberStr = numberStr.replace(/,/g, '');
			} else {
				// 1.234,56 -> remove dot, replace comma with dot
				numberStr = numberStr.replace(/\./g, '').replace(/,/g, '.');
			}
		} else if ((numberStr.match(/,/g) || []).length > 1) {
			// Multiple commas: 1,234,567 -> remove all
			numberStr = numberStr.replace(/,/g, '');
		} else if (/^\d{1,3}(,\d{3})+$/.test(numberStr)) {
			// 1,234 or 12,345 format -> remove comma
			numberStr = numberStr.replace(/,/g, '');
		} else {
			// Single comma, not obviously thousands: 1,5 -> 1.5
			numberStr = numberStr.replace(',', '.');
		}

		const parsed = parseFloat(numberStr);
		return isNaN(parsed) ? 1 : parsed;
	}
}
