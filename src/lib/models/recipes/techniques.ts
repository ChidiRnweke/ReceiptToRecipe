/**
 * The cooking vocabulary. Every recipe step, whether made up, snapped or typed, starts with one of
 * these verbs when it names a technique, and each verb carries a short explanation of why it
 * works and something to try. The wording comes from the door prototype.
 */
export const TECHNIQUE_VERBS = [
	'Sweat',
	'Sauté',
	'Sear',
	'Bloom',
	'Simmer',
	'Reduce',
	'Roast',
	'Fold',
	'Rest',
	'Boil'
] as const;

export type TechniqueVerb = (typeof TECHNIQUE_VERBS)[number];

export interface Technique {
	verb: TechniqueVerb;
	/** Stable key for storage: the verb in lower-case ASCII, e.g. `saute`. */
	key: string;
	why: string;
	tryIt: string;
}

export const TECHNIQUES: Record<TechniqueVerb, Technique> = {
	Sweat: {
		verb: 'Sweat',
		key: 'sweat',
		why: 'Low heat and a pinch of salt soften onions without browning. The salt draws out water, which keeps the pan too cool to brown, so they turn sweet instead of bitter.',
		tryIt: 'Sweat one onion and brown another. Same onion, very different taste.'
	},
	Sauté: {
		verb: 'Sauté',
		key: 'saute',
		why: 'Medium-high heat, one layer, moved often. A crowded pan cools down and steams instead of colouring.',
		tryIt: 'If the sizzle stops when you add food, cook in two batches.'
	},
	Sear: {
		verb: 'Sear',
		key: 'sear',
		why: 'Browning starts around 140 °C. A wet surface stays at 100 °C until it dries, so pat it dry and leave it alone until it lets go of the pan.',
		tryIt: 'If it sticks, it isn’t ready to turn.'
	},
	Bloom: {
		verb: 'Bloom',
		key: 'bloom',
		why: 'Many flavours in spices dissolve in fat, not water. A minute in hot oil spreads them through the whole dish.',
		tryIt: 'Move on as soon as it smells fragrant: ground spices burn fast.'
	},
	Simmer: {
		verb: 'Simmer',
		key: 'simmer',
		why: 'Small, lazy bubbles: hot enough to cook through, gentle enough that things stay tender.',
		tryIt: 'If the surface churns, turn it down until only a few bubbles break.'
	},
	Reduce: {
		verb: 'Reduce',
		key: 'reduce',
		why: 'Without a lid, water evaporates, which concentrates flavour and thickens. Season afterwards: the salt concentrates too.',
		tryIt: 'Drag a spoon through. If the line holds, it’s ready.'
	},
	Roast: {
		verb: 'Roast',
		key: 'roast',
		why: 'Dry heat above 200 °C browns the outside while the inside cooks. Spread things out so steam can escape.',
		tryIt: 'Two trays beat one crowded tray.'
	},
	Fold: {
		verb: 'Fold',
		key: 'fold',
		why: 'Gentle mixing keeps delicate things whole. Off the heat, spinach wilts from the leftover warmth and stays green.',
		tryIt: 'Lift from the bottom and turn over. Don’t stir.'
	},
	Rest: {
		verb: 'Rest',
		key: 'rest',
		why: 'As the heat evens out, the juices settle back in. Cut too early and they end up on the board.',
		tryIt: 'Rest chicken 3 minutes. It counts as cooking time.'
	},
	Boil: {
		verb: 'Boil',
		key: 'boil',
		why: 'A big pot at a rolling boil, salted like a mild soup, cooks pasta and rice evenly and seasons them from the inside.',
		tryIt: 'Taste the water. It should taste pleasantly salty.'
	}
};

export function isTechniqueVerb(value: string | null | undefined): value is TechniqueVerb {
	return value != null && (TECHNIQUE_VERBS as readonly string[]).includes(value);
}
