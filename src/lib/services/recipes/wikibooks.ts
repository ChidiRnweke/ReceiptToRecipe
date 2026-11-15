/**
 * Reads a Wikibooks Cookbook page's wikitext: its recipe summary box, lead paragraph, Ingredients
 * and Procedure sections, and categories. Pure, so it runs on committed fixture pages in tests.
 */
import type { ParsedWikibooksRecipe, WikibooksSections } from '$lib/models/recipes';

const INGREDIENTS_HEADING = /^ingredients?\b/i;
const PROCEDURE_HEADING = /^(procedures?|preparation|method|directions|instructions|steps)\b/i;

/** A line that starts with an amount: a digit, a fraction character, or "a"/"an"/"one"… */
const AMOUNT = /^(\d|[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|(a|an|one|two|three|four|five|six|half|dozen)\s)/i;

/** Replaces `{{name|…}}` templates, innermost first, with what `render` returns for each. */
function replaceTemplates(text: string, render: (name: string, args: string[]) => string): string {
	let previous: string;
	let current = text;
	do {
		previous = current;
		current = current.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
			const [name, ...args] = body.split('|');
			return render(
				name.trim().toLowerCase(),
				args.map((arg) => arg.trim())
			);
		});
	} while (current !== previous);
	return current;
}

/** `{{convert|8|oz|g|abbr=on}}` → "8 oz"; `{{cb|sugar}}` → "sugar"; other templates go. */
function renderInline(name: string, args: string[]): string {
	const positional = args.filter((arg) => !arg.includes('='));
	if (name === 'convert' || name === 'cvt') {
		const [amount, unit] = positional;
		if (!amount) return '';
		return unit ? `${amount} ${unit}` : amount;
	}
	if (name === 'cb' || name === 'cookbook' || name === 'w') {
		return positional[positional.length > 1 ? 1 : 0] ?? '';
	}
	if (name === 'frac' && positional.length >= 2) {
		return positional.length === 3
			? `${positional[0]} ${positional[1]}/${positional[2]}`
			: `${positional[0]}/${positional[1]}`;
	}
	return '';
}

/** One line of wikitext as plain text: links read as their label, markup and notes removed. */
export function plainText(line: string): string {
	let text = line
		.replace(/<ref[^>]*\/>/gi, '')
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
		.replace(/<br\s*\/?>/gi, ' ');
	text = replaceTemplates(text, renderInline);
	text = text
		.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
		.replace(/\[\[Category:[^\]]*\]\]/gi, '')
		.replace(
			/\[\[([^|\]]*)\|([^\]]*)\]\](\w*)/g,
			(_, _target, label: string, tail: string) => label + tail
		)
		.replace(
			/\[\[([^\]]*)\]\](\w*)/g,
			(_, target: string, tail: string) => target.replace(/^\s*:?\s*Cookbook\s*:\s*/i, '') + tail
		)
		.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
		.replace(/\[https?:\/\/\S+\]/g, '')
		.replace(/'''?/g, '')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
	return text;
}

/** The parameters of the page's recipe summary box, keys in lower case. */
function summaryOf(wikitext: string): Map<string, string> {
	const params = new Map<string, string>();
	const match = /\{\{\s*recipe\s*summary([\s\S]*?)\n?\}\}/i.exec(wikitext);
	if (!match) return params;
	// Links and nested templates may hold "|"; protect them before splitting.
	const body = match[1]
		.replace(/\[\[[^\]]*\]\]/g, (link) => link.replace(/\|/g, '\uE000'))
		.replace(/\{\{[^}]*\}\}/g, (template) => template.replace(/\|/g, '\uE000'));
	for (const part of body.split('|')) {
		const eq = part.indexOf('=');
		if (eq === -1) continue;
		const key = part.slice(0, eq).trim().toLowerCase();
		const value = plainText(part.slice(eq + 1).replace(/\uE000/g, '|'));
		if (key && value) params.set(key, value);
	}
	return params;
}

type Part = 'lead' | 'ingredients' | 'procedure' | 'other';

/**
 * The page's lines by part. A heading of any level named Ingredients or Procedure (or
 * Preparation, Method…) starts that part; another level-2 heading ends it, while deeper headings
 * such as "=== For the sauce ===" stay inside it.
 */
function partsOf(wikitext: string): Record<Part, string[]> {
	const parts: Record<Part, string[]> = { lead: [], ingredients: [], procedure: [], other: [] };
	let current: Part = 'lead';
	let seen = { ingredients: false, procedure: false };
	for (const line of wikitext.split(/\r?\n/)) {
		const heading = /^(={2,6})\s*([^=].*?)\s*\1\s*$/.exec(line.trim());
		if (!heading) {
			parts[current].push(line);
			continue;
		}
		const title = plainText(heading[2]);
		if (INGREDIENTS_HEADING.test(title) && !seen.ingredients) {
			current = 'ingredients';
			seen = { ...seen, ingredients: true };
		} else if (PROCEDURE_HEADING.test(title) && !seen.procedure) {
			current = 'procedure';
			seen = { ...seen, procedure: true };
		} else if (heading[1].length === 2 || current === 'lead') {
			current = 'other';
		}
	}
	return parts;
}

/** The text of list items (`*` or `#`) in the lines, without the marker. */
function listItems(lines: string[], marker: '*' | '#'): string[] {
	return lines
		.map((line) => line.trim())
		.filter((line) => line.startsWith(marker) && !/^[*#]+\s*:/.test(line))
		.map((line) => plainText(line.replace(/^[*#]+/, '')))
		.filter((line) => line.length > 0);
}

/** The first paragraph of the lead, without templates and boxes. */
function leadParagraph(lead: string[]): string {
	const joined = replaceTemplates(lead.join('\n'), () => '');
	for (const paragraph of joined.split(/\n\s*\n/)) {
		const text = plainText(paragraph.replace(/^__\w+__$/gm, ''));
		if (text.length > 20 && !/^\|/.test(text)) return text;
	}
	return '';
}

/** Category words that end like a demonym but name an ingredient or a dish. */
const NOT_CUISINES = new Set([
	'potato',
	'tomato',
	'avocado',
	'mango',
	'pesto',
	'risotto',
	'burrito',
	'gazpacho',
	'sandwich',
	'pistachio',
	'espresso',
	'gnocchi',
	'chili',
	'organic',
	'garlic',
	'christian'
]);

function cuisineOf(summary: Map<string, string>): string | null {
	const cuisine = summary.get('cuisine');
	if (cuisine) return cuisine;
	const category = summary.get('category') ?? '';
	const named = /^(.+?) recipes$/i.exec(category);
	if (!named) return null;
	// "Beef recipes" or "Cake recipes" name an ingredient or a dish, not a cuisine.
	const word = named[1];
	const demonym =
		/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)?$/.test(word) && /(an|ese|ish|ic|i|o|ch)$/.test(word);
	return demonym && !NOT_CUISINES.has(word.toLowerCase()) ? word : null;
}

/**
 * The recipe in a page's wikitext. A redirect, a page without an Ingredients section, one whose
 * ingredients carry no amounts and one without steps are refused with the reason.
 */
export function parseWikibooksRecipe(wikitext: string): ParsedWikibooksRecipe {
	if (/^\s*#redirect/i.test(wikitext)) return { ok: false, reason: 'redirect' };

	const parts = partsOf(wikitext);
	const ingredients = listItems(parts.ingredients, '*');
	if (ingredients.length === 0) return { ok: false, reason: 'no-ingredients' };
	if (!ingredients.some((line) => AMOUNT.test(line))) return { ok: false, reason: 'no-amounts' };

	let procedure = listItems(parts.procedure, '#');
	if (procedure.length === 0) procedure = listItems(parts.procedure, '*');
	if (procedure.length === 0) return { ok: false, reason: 'no-steps' };

	const summary = summaryOf(wikitext);
	const categories = [...wikitext.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)].map(
		(match) => match[1].trim()
	);
	const sectionsFound: WikibooksSections = {
		ingredients,
		procedure,
		description: leadParagraph(parts.lead),
		servings: summary.get('servings') ?? summary.get('yield') ?? null,
		time: summary.get('time') ?? null,
		cuisine: cuisineOf(summary),
		categories: [...new Set(categories)]
	};
	return { ok: true, sections: sectionsFound };
}

/** "Cookbook:Adobo Chicken (Philippine)" → "Adobo Chicken (Philippine)". */
export function recipeTitleOf(pageTitle: string): string {
	return pageTitle.replace(/^Cookbook:/, '').trim();
}
