/**
 * The deterministic structurer: turns a parsed Wikibooks page into the app's recipe shape with
 * rules only. It runs when no model is available (or IMPORTER_STRUCTURER=rules). It reads amounts
 * and units off ingredient lines and one step per procedure line; it does not judge tags such as
 * "keeps-well" that need a model.
 */
import type {
	CookbookIngredient,
	CookbookStructure,
	RecipeTag,
	WikibooksSections
} from '$lib/models/recipes';
import { RECIPE_TAGS } from '$lib/models/recipes';
import { splitVerb } from './steps';
import { deriveTags } from './tags';

const FRACTIONS: Record<string, number> = {
	'¼': 0.25,
	'½': 0.5,
	'¾': 0.75,
	'⅓': 1 / 3,
	'⅔': 2 / 3,
	'⅛': 0.125,
	'⅜': 0.375,
	'⅝': 0.625,
	'⅞': 0.875,
	'⅕': 0.2,
	'⅖': 0.4,
	'⅗': 0.6,
	'⅘': 0.8,
	'⅙': 1 / 6,
	'⅚': 5 / 6
};

const WORD_NUMBERS: Record<string, number> = {
	a: 1,
	an: 1,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	half: 0.5,
	dozen: 12
};

/** Unit words as written on pages, and the unit the app stores. */
const UNITS: Record<string, string> = {
	g: 'g',
	gram: 'g',
	grams: 'g',
	gramme: 'g',
	grammes: 'g',
	kg: 'kg',
	kilogram: 'kg',
	kilograms: 'kg',
	mg: 'mg',
	ml: 'ml',
	millilitre: 'ml',
	milliliter: 'ml',
	millilitres: 'ml',
	milliliters: 'ml',
	l: 'l',
	litre: 'l',
	liter: 'l',
	litres: 'l',
	liters: 'l',
	dl: 'dl',
	cl: 'cl',
	tsp: 'tsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tbsp: 'tbsp',
	tbs: 'tbsp',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	cup: 'cup',
	cups: 'cup',
	oz: 'oz',
	ounce: 'oz',
	ounces: 'oz',
	'fl oz': 'fl oz',
	lb: 'lb',
	lbs: 'lb',
	pound: 'lb',
	pounds: 'lb',
	pint: 'pint',
	pints: 'pint',
	quart: 'quart',
	quarts: 'quart',
	clove: 'clove',
	cloves: 'clove',
	pinch: 'pinch',
	pinches: 'pinch',
	dash: 'dash',
	dashes: 'dash',
	can: 'can',
	cans: 'can',
	tin: 'can',
	tins: 'can',
	package: 'package',
	packages: 'package',
	packet: 'package',
	packets: 'package',
	slice: 'slice',
	slices: 'slice',
	bunch: 'bunch',
	bunches: 'bunch',
	handful: 'handful',
	handfuls: 'handful',
	piece: 'piece',
	pieces: 'piece',
	stick: 'stick',
	sticks: 'stick',
	sprig: 'sprig',
	sprigs: 'sprig',
	head: 'head',
	heads: 'head',
	stalk: 'stalk',
	stalks: 'stalk',
	measure: 'measure',
	measures: 'measure',
	tuber: 'piece',
	tubers: 'piece'
};

/** Words that say how an ingredient is cut or prepared; they move to the notes. */
const PREPARATION =
	/^(finely|coarsely|roughly|thinly|freshly|lightly|well)?-?\s*(chopped|sliced|diced|minced|grated|crushed|cracked|ground|peeled|shredded|cubed|melted|softened|beaten|sifted|drained|rinsed|halved|quartered|mashed|toasted|roasted)\b\s*/i;

/** A number at the start of the text: "1", "1.5", "1 1/2", "1½", "½", "6–8", "6-8". */
const NUMBER =
	/^(\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*(?:–|-|to)\s*(\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\d+(?:[.,]\d+)?))?/;

function numberOf(text: string): number {
	const trimmed = text.trim().replace(',', '.');
	const fraction = /^(\d*)\s*([¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])$/.exec(trimmed);
	if (fraction) return (fraction[1] ? parseInt(fraction[1], 10) : 0) + FRACTIONS[fraction[2]];
	const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed);
	if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
	const simple = /^(\d+)\/(\d+)$/.exec(trimmed);
	if (simple) return parseInt(simple[1], 10) / parseInt(simple[2], 10);
	return parseFloat(trimmed);
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/**
 * One ingredient line as an amount, a unit and a name. Parenthesised conversions and text after
 * a comma become notes; "to taste" and "optional" are read. Without an amount the quantity is 0.
 */
export function parseIngredientLine(line: string): CookbookIngredient {
	let rest = line.trim();
	const notes: string[] = [];

	// Notes in parentheses, e.g. "(240 g / 8.5 oz)" or "(figures are for fat-free)".
	rest = rest.replace(/\s*\(([^()]*)\)/g, (_, note: string) => {
		if (note.trim()) notes.push(note.trim());
		return '';
	});

	let quantity = 0;
	const number = NUMBER.exec(rest);
	if (number) {
		const low = numberOf(number[1]);
		const high = number[2] ? numberOf(number[2]) : low;
		quantity = round((low + high) / 2);
		rest = rest.slice(number[0].length).trim();
	} else {
		const word = /^(a|an|one|two|three|four|five|six|half|dozen)\s+/i.exec(rest);
		if (word) {
			quantity = WORD_NUMBERS[word[1].toLowerCase()];
			rest = rest.slice(word[0].length).trim();
		}
	}

	let unit = '';
	if (quantity > 0) {
		const unitMatch = /^(fl\.?\s*oz|[a-zA-Z]+)\.?\b\s*/.exec(rest);
		const word = unitMatch?.[1].toLowerCase().replace(/\.\s*/, ' ').replace(/\s+/g, ' ');
		if (word && UNITS[word]) {
			unit = UNITS[word];
			rest = rest.slice(unitMatch![0].length).trim();
		}
		rest = rest.replace(/^of\s+/i, '');
	}

	const comma = rest.indexOf(',');
	if (comma !== -1) {
		const after = rest.slice(comma + 1).trim();
		if (after) notes.push(after);
		rest = rest.slice(0, comma).trim();
	}

	const toTaste = /\s*\bto taste\b\s*/i;
	if (toTaste.test(rest)) {
		notes.push('to taste');
		rest = rest.replace(toTaste, ' ').trim();
	}
	const optionalWord = /\s*\(?\boptional\b\)?\s*/i;
	const optional =
		optionalWord.test(rest) || notes.some((note) => /^optional\b/i.test(note.trim()));
	rest = rest.replace(optionalWord, ' ').trim();

	const prepared = PREPARATION.exec(rest);
	if (prepared && prepared[0].length < rest.length) {
		notes.push(prepared[0].trim().replace(/-$/, ''));
		rest = rest.slice(prepared[0].length).trim();
	}

	const name = rest.replace(/^[-–:;\s]+|[-–:;.\s]+$/g, '') || line.trim();
	return {
		name: name.slice(0, 120),
		quantity,
		unit,
		optional,
		notes: notes.length ? notes.join('; ').slice(0, 200) : null
	};
}

/** Minutes in "20 minutes", "1 hour 30 min" or "Prep: 20 minutes Baking: 60 minutes", or null. */
export function minutesIn(text: string | null): number | null {
	if (!text) return null;
	let total = 0;
	for (const match of text.matchAll(
		/(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi
	)) {
		const value = match[2] ? parseFloat(match[2]) : parseFloat(match[1]);
		total += /^h/i.test(match[3]) ? value * 60 : value;
	}
	return total > 0 ? Math.round(total) : null;
}

/** The first number in "4", "8–10" or "Serves 6", or null. */
export function servingsIn(text: string | null): number | null {
	if (!text) return null;
	const match = /(\d+)/.exec(text);
	if (!match) return null;
	const value = parseInt(match[1], 10);
	return value >= 1 && value <= 48 ? value : null;
}

/**
 * Course and planning tags the page's own categories name, e.g. "Recipes for dessert" → dessert.
 * Diet tags are left to the rules, which read every ingredient: a page's diet category is not
 * checked by anyone.
 */
export function tagsFromCategories(categories: string[]): RecipeTag[] {
	const found = new Set<RecipeTag>();
	for (const category of categories.map((name) => name.toLowerCase())) {
		if (/dessert|cake recipes|cookie recipes|pie recipes|candy recipes/.test(category))
			found.add('dessert');
		if (/breakfast/.test(category)) found.add('breakfast');
		if (/main course|main dish/.test(category)) found.add('main');
		if (/side dish/.test(category)) found.add('side');
		if (/snack|appetizer/.test(category)) found.add('snack');
		if (/freez/.test(category)) found.add('freezes');
	}
	return RECIPE_TAGS.filter((tag) => found.has(tag));
}

/** The page's sections as a catalog recipe, by rules only. */
export function structureByRules(title: string, sections: WikibooksSections): CookbookStructure {
	const ingredients = sections.ingredients.map(parseIngredientLine);
	const steps = sections.procedure.map((line) => {
		const { verb, text } = splitVerb(line);
		return { verb, text: text || line, minutes: minutesIn(line) };
	});
	const total = minutesIn(sections.time);
	const rule = deriveTags({ prepTime: total, cookTime: null }, ingredients, steps);
	const all = new Set<RecipeTag>([...rule, ...tagsFromCategories(sections.categories)]);
	return {
		title,
		description: sections.description.slice(0, 600),
		servings: servingsIn(sections.servings) ?? 4,
		prepTime: total,
		cookTime: null,
		cuisine: sections.cuisine,
		ingredients: ingredients.slice(0, 80),
		steps: steps.slice(0, 80),
		tags: RECIPE_TAGS.filter((tag) => all.has(tag))
	};
}
