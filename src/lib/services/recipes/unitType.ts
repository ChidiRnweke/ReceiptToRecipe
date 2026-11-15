const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb', 'lbs', 'mg'];
const VOLUME_UNITS = [
	'ml',
	'l',
	'dl',
	'cl',
	'cup',
	'cups',
	'tbsp',
	'tsp',
	'fl oz',
	'pint',
	'quart',
	'gallon'
];

/** Whether an ingredient's unit weighs, measures volume or counts. */
export function unitTypeOf(unit: string): 'WEIGHT' | 'VOLUME' | 'COUNT' {
	const lower = unit.toLowerCase();
	if (WEIGHT_UNITS.includes(lower)) return 'WEIGHT';
	if (VOLUME_UNITS.includes(lower)) return 'VOLUME';
	return 'COUNT';
}
