/**
 * Types of the Use it up door: "What needs eating first?".
 *
 * The door lists the perishables and leftovers that are off or go off within a few days, and
 * everything else the kitchen holds, from the kitchen picture.
 */

import { z } from 'zod';

/** A stock item as the door shows it. */
export interface HomeItem {
	itemKey: string;
	/** As people know it: "Cherry tomatoes", "Saag paneer" for its leftovers. */
	name: string;
	/** "450 g", "6", "2 portions". */
	amount: string;
	quantity: number;
	unit: string;
	/** False when cooking drew on it, so the amount is an estimate. */
	known: boolean;
	/** Only expired lots are left: it has probably gone off. */
	off: boolean;
	/** Whole days until it expires; negative once it has passed. */
	daysLeft: number;
	perishable: boolean;
	leftover: boolean;
}

export interface UseItUpView {
	greeting: string;
	question: string;
	/** The household records purchases. A household that does not, with nothing at home, sees an empty state. */
	tracks: boolean;
	/** Just after a shop: the names to put at the front, e.g. "feta, yogurt and chicken thighs". */
	frontNames: string | null;
	eatFirst: HomeItem[];
	/** Everything else at home, by name. */
	everything: HomeItem[];
}

/** A recipe that uses the item, for the "Ideas" sheet. */
export interface UseItUpIdea {
	recipeId: string;
	title: string;
	imageUrl: string | null;
	minutes: number | null;
	/** Perishables it uses before they go. */
	uses: string[];
	missing: string[];
}

export interface ChangeResult {
	message: string;
	/** The kitchen event to delete to take the change back. */
	undoId: string;
}

const itemKey = z.string().trim().min(1).max(200);

export const itemInput = z.object({ itemKey });
export const undoInput = z.object({ undoId: z.uuid() });
export const addItemInput = z.object({
	name: z.string().trim().min(1).max(120),
	quantity: z.number().positive().max(100000).nullable().optional(),
	unit: z.string().trim().max(20).nullable().optional(),
	category: z.string().trim().max(40).nullable().optional()
});
export const setQuantityInput = z.object({
	itemKey,
	quantity: z.number().min(0).max(100000),
	unit: z.string().trim().max(20).nullable().optional()
});

export type AddItemInput = z.infer<typeof addItemInput>;
export type SetQuantityInput = z.infer<typeof setQuantityInput>;

/** What the add or edit sheet saves. */
export interface ItemSave {
	name: string;
	quantity: number | null;
	unit: string | null;
	category: string | null;
}

/** Categories a person can pick when adding something; each gives a shelf life. */
export const ADD_CATEGORIES = [
	'produce',
	'dairy',
	'meat',
	'seafood',
	'bakery',
	'pantry',
	'frozen',
	'canned',
	'other'
] as const;
