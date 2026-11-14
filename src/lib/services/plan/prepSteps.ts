import type { PrepStep } from '$lib/models/plan';

/**
 * The order the verbs of two dishes go in when they are cooked in one go: the long waits
 * (water to boil, the oven) start first, the quick finishing steps come last. Unknown verbs sit
 * in the middle.
 */
const VERB_ORDER: Record<string, number> = {
	preheat: -1,
	boil: 0,
	roast: 1,
	simmer: 2,
	sweat: 3,
	bloom: 4,
	sear: 5,
	sauté: 6,
	saute: 6,
	reduce: 7,
	fold: 8,
	rest: 9
};
const UNKNOWN_ORDER = 5;
/** "Both in one go" shows this many steps. */
export const PREP_STEP_LIMIT = 6;
/** Cooking two dishes side by side takes this much longer than the longer one. */
export const PREP_EXTRA_MINUTES = 15;

/** "curry" from "Spinach & chickpea curry". */
function dishName(title: string): string {
	return (title.trim().split(/\s+/).pop() ?? title).toLowerCase();
}

/** Splits "1. Boil the pasta, 10 min." into the verb "Boil" and "the pasta, 10 min.". */
function splitStep(step: string): { verb: string | null; text: string } {
	const line = step.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim();
	const [first, ...rest] = line.split(/\s+/);
	const word = (first ?? '').replace(/[^\p{L}]/gu, '');
	if (word.toLowerCase() in VERB_ORDER && rest.length) {
		return { verb: word[0].toUpperCase() + word.slice(1).toLowerCase(), text: rest.join(' ') };
	}
	return { verb: null, text: line };
}

/**
 * The steps of the prep dishes merged into one order, so both cook in one session. Steps keep
 * their own dish's order when their verbs rank the same.
 */
export function mergePrepSteps(dishes: { title: string; steps: string[] }[]): PrepStep[] {
	return dishes
		.flatMap((dish, d) =>
			dish.steps.map((step, i) => ({ ...splitStep(step), dish: dishName(dish.title), d, i }))
		)
		.map((step) => ({
			step,
			rank: step.verb ? (VERB_ORDER[step.verb.toLowerCase()] ?? UNKNOWN_ORDER) : UNKNOWN_ORDER
		}))
		.sort((a, b) => a.rank - b.rank || a.step.d - b.step.d || a.step.i - b.step.i)
		.slice(0, PREP_STEP_LIMIT)
		.map(({ step }) => ({ verb: step.verb, text: step.text, dish: step.dish }));
}
