import { LEFTOVER_PREFIX } from '$lib/models/kitchen';

/**
 * Item keys: one key per kitchen item, so that "Eggs", "egg" and " EGGS " are the same thing.
 *
 * Rules, in order:
 * 1. Unicode NFKC, lower case. Apostrophes are removed ("Kellogg's" → "kelloggs"); every other
 *    character that is not a letter, digit or space becomes a space ("semi-skimmed" →
 *    "semi skimmed"). Accented letters stay ("crème fraîche").
 * 2. Spaces are trimmed and collapsed.
 * 3. Only the last word is made singular, because it names the item ("cherry tomatoes" →
 *    "cherry tomato"). A last word of three letters or fewer, or one with a digit, stays.
 *
 * Singular rules for the last word, first match wins:
 * - an irregular plural from {@link IRREGULAR}: "leaves" → "leaf", "chillies" → "chilli";
 * - a word in {@link INVARIANT}, or ending in -ss or -us, stays: "molasses", "haggis",
 *   "swiss", "hummus", "couscous", "asparagus". Words ending in -is are not kept as a rule,
 *   because "kiwis" and "salamis" are plurals;
 * - -ies → -y for words longer than four letters: "berries" → "berry" ("pies" → "pie");
 * - -oes → -o: "tomatoes" → "tomato", "potatoes" → "potato";
 * - -ches, -shes, -xes, -sses, -zzes → drop "es": "peaches" → "peach", "boxes" → "box";
 * - otherwise a trailing -s is dropped: "eggs" → "egg", "chickpeas" → "chickpea",
 *   "cheeses" → "cheese", "olives" → "olive".
 *
 * The rules prefer merging two items that are really one over keeping two keys apart. A rare
 * wrong singular ("fries" → "fry") still gives one stable key per item, which is all the
 * projection needs.
 */

const INVARIANT = new Set(['molasses', 'species', 'series', 'news', 'grits', 'haggis', 'pastis']);

const IRREGULAR: Record<string, string> = {
	leaves: 'leaf',
	loaves: 'loaf',
	halves: 'half',
	knives: 'knife',
	chillies: 'chilli',
	chilies: 'chili',
	cookies: 'cookie',
	brownies: 'brownie',
	veggies: 'veggie',
	smoothies: 'smoothie',
	quiches: 'quiche',
	brioches: 'brioche',
	sloes: 'sloe'
};

/** The singular of one lower-case word, by the rules above. */
export function singularize(word: string): string {
	if (word.length <= 3 || !/^\p{L}+$/u.test(word)) return word;
	if (IRREGULAR[word]) return IRREGULAR[word];
	if (INVARIANT.has(word) || /(ss|us)$/.test(word)) return word;
	if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
	if (word.endsWith('oes')) return word.slice(0, -2);
	if (/(ch|sh|x|ss|zz)es$/.test(word)) return word.slice(0, -2);
	if (word.endsWith('s')) return word.slice(0, -1);
	return word;
}

/** The key of an item name: lower case, no punctuation, single spaces, last word singular. */
export function normalizeItemKey(name: string): string {
	const words = name
		.normalize('NFKC')
		.toLowerCase()
		.replace(/['’`]/g, '')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0);
	if (words.length === 0) return '';
	words[words.length - 1] = singularize(words[words.length - 1]);
	return words.join(' ');
}

/**
 * The key an event or lot is matched on. Leftover keys (`leftover:<id>`) name a cooked meal,
 * not a product, and stay as they are; every other key is normalized, so events stored before
 * the current rules (or by the backfill) merge with new ones.
 */
export function canonicalItemKey(itemKey: string): string {
	return itemKey.startsWith(LEFTOVER_PREFIX) ? itemKey : normalizeItemKey(itemKey);
}
