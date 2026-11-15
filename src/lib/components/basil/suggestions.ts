import type { BasilDoor } from '$lib/models/agent';

/** A few things to ask on each door, in the prototype's words. */
export const SUGGESTIONS: Record<BasilDoor, string[]> = {
	tonight: ['Friends over Friday', 'What can I do with the spinach?'],
	plan: ['Plan the whole week', 'Something new'],
	shop: ['Why is chicken on the list?'],
	recipes: ['Something warm with chickpeas'],
	'use-it-up': ['What can I do with the feta?']
};

/** What Basil says before anyone has asked anything. */
export const BASIL_HELLO =
	'Tell me what’s going on: “friends over Friday”, “we’re away till Sunday”, “what can I do with feta?”.';
