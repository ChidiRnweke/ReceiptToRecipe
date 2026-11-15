/** The doors Basil can open and refresh. */
export const BASIL_DOORS = ['tonight', 'plan', 'shop', 'recipes', 'use-it-up'] as const;
export type BasilDoor = (typeof BASIL_DOORS)[number];

/** The page a door lives at. */
export const DOOR_PATH = {
	tonight: '/tonight',
	plan: '/plan',
	shop: '/shop',
	recipes: '/recipes',
	'use-it-up': '/use-it-up'
} as const satisfies Record<BasilDoor, string>;
