/**
 * Unit conversion for kitchen quantities. Receipts record g, ml or count; recipes use cooking
 * units as well. Amounts convert within one dimension (mass, volume, count). Recipe units that
 * name a whole thing (a clove, a can, a bunch, a pack) count as one item each.
 */

export type BaseUnit = 'g' | 'ml' | 'count';

interface UnitFactor {
	base: BaseUnit;
	factor: number;
}

const UNITS: Record<string, UnitFactor> = {
	mg: { base: 'g', factor: 0.001 },
	g: { base: 'g', factor: 1 },
	gram: { base: 'g', factor: 1 },
	grams: { base: 'g', factor: 1 },
	kg: { base: 'g', factor: 1000 },
	kilogram: { base: 'g', factor: 1000 },
	kilograms: { base: 'g', factor: 1000 },
	oz: { base: 'g', factor: 28.35 },
	ounce: { base: 'g', factor: 28.35 },
	ounces: { base: 'g', factor: 28.35 },
	lb: { base: 'g', factor: 453.6 },
	lbs: { base: 'g', factor: 453.6 },
	pound: { base: 'g', factor: 453.6 },
	pounds: { base: 'g', factor: 453.6 },

	ml: { base: 'ml', factor: 1 },
	milliliter: { base: 'ml', factor: 1 },
	millilitre: { base: 'ml', factor: 1 },
	cl: { base: 'ml', factor: 10 },
	dl: { base: 'ml', factor: 100 },
	l: { base: 'ml', factor: 1000 },
	liter: { base: 'ml', factor: 1000 },
	litre: { base: 'ml', factor: 1000 },
	liters: { base: 'ml', factor: 1000 },
	litres: { base: 'ml', factor: 1000 },
	tsp: { base: 'ml', factor: 5 },
	teaspoon: { base: 'ml', factor: 5 },
	teaspoons: { base: 'ml', factor: 5 },
	tbsp: { base: 'ml', factor: 15 },
	tablespoon: { base: 'ml', factor: 15 },
	tablespoons: { base: 'ml', factor: 15 },
	cup: { base: 'ml', factor: 240 },
	cups: { base: 'ml', factor: 240 },
	'fl oz': { base: 'ml', factor: 30 },

	count: { base: 'count', factor: 1 },
	'': { base: 'count', factor: 1 },
	x: { base: 'count', factor: 1 },
	pc: { base: 'count', factor: 1 },
	pcs: { base: 'count', factor: 1 },
	piece: { base: 'count', factor: 1 },
	pieces: { base: 'count', factor: 1 },
	each: { base: 'count', factor: 1 },
	unit: { base: 'count', factor: 1 },
	units: { base: 'count', factor: 1 },
	whole: { base: 'count', factor: 1 },
	clove: { base: 'count', factor: 1 },
	cloves: { base: 'count', factor: 1 },
	can: { base: 'count', factor: 1 },
	cans: { base: 'count', factor: 1 },
	tin: { base: 'count', factor: 1 },
	tins: { base: 'count', factor: 1 },
	bunch: { base: 'count', factor: 1 },
	bunches: { base: 'count', factor: 1 },
	pack: { base: 'count', factor: 1 },
	packs: { base: 'count', factor: 1 },
	package: { base: 'count', factor: 1 },
	slice: { base: 'count', factor: 1 },
	slices: { base: 'count', factor: 1 }
};

function lookup(unit: string | null | undefined): UnitFactor | null {
	const key = (unit ?? '').trim().toLowerCase().replace(/\.$/, '');
	return UNITS[key] ?? null;
}

/** Converts `quantity` from one unit to another, or returns null when they measure different things. */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
	const from = lookup(fromUnit);
	const to = lookup(toUnit);
	if (!from || !to || from.base !== to.base) return null;
	return (quantity * from.factor) / to.factor;
}

/** Expresses a quantity in g, ml or count, or returns null for an unknown unit. */
export function toBaseUnit(
	quantity: number,
	unit: string
): { quantity: number; unit: BaseUnit } | null {
	const known = lookup(unit);
	if (!known) return null;
	return { quantity: quantity * known.factor, unit: known.base };
}
