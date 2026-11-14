import {
	TECHNIQUE_VERBS,
	TECHNIQUES,
	type ParsedStep,
	type RecipeStep,
	type TechniqueVerb
} from '$lib/models/recipes';

/** "Step 2:", "step 2 -", "2." or "2)" at the start of a line. */
const STEP_PREFIX = /^\s*(step\s*\d+\s*[:.)-]?|\d+\s*[.):-])\s*/i;

function fold(word: string): string {
	return word
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z]/g, '');
}

const BY_FOLDED = new Map<string, TechniqueVerb>(TECHNIQUE_VERBS.map((verb) => [fold(verb), verb]));

/** The vocabulary verb a word names, ignoring case, accents and punctuation; null otherwise. */
export function normalizeVerb(word: string | null | undefined): TechniqueVerb | null {
	if (!word) return null;
	return BY_FOLDED.get(fold(word)) ?? null;
}

/** Splits "Sweat the onion" into its verb and the rest. A step without a known verb keeps its text. */
export function splitVerb(line: string): { verb: TechniqueVerb | null; text: string } {
	const trimmed = line.trim();
	const space = trimmed.search(/\s/);
	const first = space === -1 ? trimmed : trimmed.slice(0, space);
	const verb = normalizeVerb(first);
	if (!verb) return { verb: null, text: trimmed };
	return { verb, text: space === -1 ? '' : trimmed.slice(space).trim() };
}

/** The vocabulary verb a step starts with, or null. */
export function verbFor(text: string): TechniqueVerb | null {
	return splitVerb(text.replace(STEP_PREFIX, '')).verb;
}

/** Reads free-text instructions as steps: one per non-empty line, without "Step N:" prefixes. */
export function parseInstructions(text: string): ParsedStep[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.replace(STEP_PREFIX, '').trim())
		.filter((line) => line.length > 0)
		.map((line, position) => ({ position, ...splitVerb(line) }));
}

/** One line per step, verb first, in position order. This is what `recipes.instructions` holds. */
export function formatInstructions(
	steps: ReadonlyArray<Pick<ParsedStep, 'position' | 'verb' | 'text'>>
): string {
	return [...steps]
		.sort((a, b) => a.position - b.position)
		.map((step) => (step.verb ? `${step.verb} ${step.text}`.trim() : step.text))
		.join('\n');
}

/** Steps parsed from instructions, with no minutes known. */
export function stepsFromInstructions(text: string): RecipeStep[] {
	return parseInstructions(text).map((step) => ({ ...step, minutes: null }));
}

interface LooseStep {
	verb: string | null;
	text: string;
	minutes: number | null;
}

/**
 * The steps of a model's recipe in the app's vocabulary. A verb outside the vocabulary is dropped
 * and the step reads as plain text; a verb the model repeated at the start of the text is removed.
 * Without steps, the instructions are parsed instead.
 */
export function stepsFromGenerated(recipe: {
	steps?: LooseStep[];
	instructions: string;
}): RecipeStep[] {
	if (!recipe.steps || recipe.steps.length === 0) return stepsFromInstructions(recipe.instructions);

	return recipe.steps
		.map((step) => {
			const verb = normalizeVerb(step.verb);
			const own = splitVerb(step.text);
			if (verb) {
				const text = own.verb === verb ? own.text : step.text.trim();
				return { verb, text, minutes: step.minutes };
			}
			if (step.verb && !own.verb) {
				// An unknown verb such as "Whisk" stays in the sentence.
				return { verb: null, text: `${step.verb} ${step.text}`.trim(), minutes: step.minutes };
			}
			return { verb: own.verb, text: own.text, minutes: step.minutes };
		})
		.filter((step) => step.verb !== null || step.text.length > 0)
		.map((step, position) => ({ position, ...step }));
}

/** The explanation behind a step's verb, when it has one. */
export function techniqueOf(verb: TechniqueVerb | null) {
	return verb ? TECHNIQUES[verb] : null;
}
