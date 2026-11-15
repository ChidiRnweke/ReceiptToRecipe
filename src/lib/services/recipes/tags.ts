import {
	DIET_TAGS,
	QUICK_MINUTES,
	RECIPE_TAGS,
	type DietTag,
	type JudgedTag,
	type RecipeTag,
	type RecipeTagSource,
	type TechniqueVerb
} from '$lib/models/recipes';

/** Lower case, without accents, so "Crème fraîche" reads as "creme fraiche". */
function fold(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A regex that matches any of the words or phrases, as whole words, with an optional plural. */
function words(list: string[]): RegExp {
	return new RegExp(`\\b(${list.join('|')})(e?s)?\\b`);
}

const MEAT = words([
	'chicken',
	'beef',
	'pork',
	'lamb',
	'mutton',
	'veal',
	'bacon',
	'ham',
	'gammon',
	'sausage',
	'chorizo',
	'salami',
	'pepperoni',
	'prosciutto',
	'pancetta',
	'guanciale',
	'nduja',
	'speck',
	'bresaola',
	'mortadella',
	'merguez',
	'frankfurter',
	'hot dog',
	'steak',
	'mince',
	'minced meat',
	'meatball',
	'meat',
	'turkey',
	'duck',
	'goose',
	'venison',
	'rabbit',
	'oxtail',
	'brisket',
	'spare rib',
	'lard',
	'suet',
	'gelatin',
	'gelatine',
	'bone broth'
]);

const FISH = words([
	'fish',
	'seafood',
	'salmon',
	'tuna',
	'cod',
	'haddock',
	'hake',
	'pollock',
	'mackerel',
	'sardine',
	'anchovy',
	'anchovie',
	'trout',
	'sea bass',
	'halibut',
	'tilapia',
	'swordfish',
	'monkfish',
	'plaice',
	'herring',
	'kipper',
	'prawn',
	'shrimp',
	'crab',
	'lobster',
	'langoustine',
	'crayfish',
	'mussel',
	'clam',
	'oyster',
	'scallop',
	'squid',
	'calamari',
	'octopus',
	'caviar',
	'roe',
	'bonito',
	'katsuobushi',
	'dashi',
	'surimi',
	'worcestershire'
]);

const DAIRY = words([
	'milk',
	'butter',
	'buttermilk',
	'cream',
	'cheese',
	'yogurt',
	'yoghurt',
	'kefir',
	'ghee',
	'parmesan',
	'parmigiano',
	'pecorino',
	'cheddar',
	'mozzarella',
	'feta',
	'ricotta',
	'mascarpone',
	'halloumi',
	'paneer',
	'gruyere',
	'brie',
	'camembert',
	'gouda',
	'emmental',
	'burrata',
	'gelato',
	'creme fraiche',
	'fromage frais',
	'quark',
	'skyr',
	'labneh',
	'custard',
	'whey'
]);

const EGG = words(['egg', 'mayonnaise', 'mayo', 'meringue', 'aioli']);
const HONEY = words(['honey']);

const GLUTEN = words([
	'flour',
	'wheat',
	'bread',
	'breadcrumb',
	'panko',
	'pasta',
	'spaghetti',
	'linguine',
	'tagliatelle',
	'fettuccine',
	'pappardelle',
	'penne',
	'fusilli',
	'rigatoni',
	'macaroni',
	'lasagne',
	'lasagna',
	'orzo',
	'ravioli',
	'tortellini',
	'gnocchi',
	'noodle',
	'udon',
	'ramen',
	'couscous',
	'bulgur',
	'bulghur',
	'barley',
	'rye',
	'spelt',
	'farro',
	'freekeh',
	'semolina',
	'seitan',
	'oat',
	'soy sauce',
	'beer',
	'ale',
	'malt',
	'pastry',
	'filo',
	'phyllo',
	'tortilla',
	'wrap',
	'pita',
	'pitta',
	'naan',
	'baguette',
	'brioche',
	'bagel',
	'croissant',
	'bun',
	'cracker',
	'biscuit',
	'cake',
	'cookie'
]);

/** Phrases that name a safe ingredient although they contain a word above. */
const NOT_MEAT = /\b(beef ?(steak )?tomato(es)?|vegetable suet)\b/g;
const NOT_FISH = /\boyster mushrooms?\b/g;
const NOT_DAIRY =
	/\b((coconut|almond|oat|soy|soya|rice|cashew|hazelnut|plant|nut) (milk|cream|yogurt|yoghurt)|(peanut|almond|cashew|nut|cocoa|apple|shea) butter|butter ?beans?|cream of tartar|creamed coconut)\b/g;
const NOT_GLUTEN =
	/\b((rice|almond|coconut|chickpea|gram|corn|buckwheat|tapioca|potato|cassava) flour|cornflour|rice noodles?|glass noodles?|rice vermicelli|corn tortillas?|rice paper|pasta sauce|tamari)\b/g;

/** Qualifiers that say the ingredient is a substitute, e.g. "vegan mayo" or "gluten-free pasta". */
const PLANT_BASED = /\b(vegan|plant[- ]based)\b/;
const MEAT_FREE = /\b(vegetarian|veggie|meat[- ]free|meatless)\b/;
const DAIRY_FREE = /\b(dairy[- ]free|non[- ]dairy|lactose[- ]free)\b/;
const GLUTEN_FREE = /\b(gluten[- ]free|gf)\b/;

interface Contents {
	meat: boolean;
	fish: boolean;
	dairy: boolean;
	egg: boolean;
	honey: boolean;
	gluten: boolean;
}

function contentsOf(name: string): Contents {
	const text = fold(name);
	const plant = PLANT_BASED.test(text);
	const meatFree = plant || MEAT_FREE.test(text);
	return {
		meat: !meatFree && MEAT.test(text.replace(NOT_MEAT, '')),
		fish: !meatFree && FISH.test(text.replace(NOT_FISH, '')),
		dairy: !plant && !DAIRY_FREE.test(text) && DAIRY.test(text.replace(NOT_DAIRY, '')),
		egg: !plant && EGG.test(text),
		honey: !plant && HONEY.test(text),
		gluten: !GLUTEN_FREE.test(text) && GLUTEN.test(text.replace(NOT_GLUTEN, ''))
	};
}

/** Verbs cooked on the hob in a pan. */
const PAN_VERBS: ReadonlySet<TechniqueVerb> = new Set(['Sweat', 'Sauté', 'Sear', 'Bloom']);
const STOVE_VERBS: ReadonlySet<TechniqueVerb> = new Set([
	'Sweat',
	'Sauté',
	'Sear',
	'Bloom',
	'Simmer',
	'Reduce',
	'Boil'
]);
const ONE_VESSEL = /\b(one|same|single)[- ](pot|pan|tray|skillet|dish)\b|\bone-pot\b/;
const SECOND_VESSEL =
	/\b(another|second|separate|other|clean) (pot|pan|saucepan|skillet|frying pan|tray)\b/;

interface TagStep {
	verb: TechniqueVerb | null;
	text: string;
	minutes: number | null;
}

/**
 * One pot when the steps say so, or when their verbs fit one vessel: no pot of boiling water
 * next to a pan, and no roasting next to the hob. A step that names a second pan rules it out.
 */
function isOnePot(steps: TagStep[]): boolean {
	const text = fold(steps.map((step) => step.text).join(' '));
	if (ONE_VESSEL.test(text)) return true;
	if (SECOND_VESSEL.test(text)) return false;
	const verbs = new Set(steps.flatMap((step) => (step.verb ? [step.verb] : [])));
	const cooks = [...verbs].some((verb) => STOVE_VERBS.has(verb) || verb === 'Roast');
	if (!cooks) return false;
	if (verbs.has('Boil') && [...verbs].some((verb) => PAN_VERBS.has(verb))) return false;
	if (verbs.has('Roast') && [...verbs].some((verb) => STOVE_VERBS.has(verb))) return false;
	return true;
}

/** The longer of the steps' minutes added up and the recipe's prep plus cook time. */
function totalMinutes(
	recipe: { prepTime: number | null; cookTime: number | null },
	steps: TagStep[]
): number {
	const fromSteps = steps.reduce((sum, step) => sum + (step.minutes ?? 0), 0);
	const fromRecipe = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
	return Math.max(fromSteps, fromRecipe);
}

/**
 * The tags rules can tell from a recipe:
 * - diet tags from its ingredients, optional ones included; none without ingredients
 * - quick when it takes 30 minutes or less, by its steps or its prep and cook time
 * - one-pot from its step verbs
 * Only the most specific diet is set: a vegan recipe is not also tagged vegetarian.
 */
export function deriveTags(
	recipe: { prepTime: number | null; cookTime: number | null },
	ingredients: ReadonlyArray<{ name: string }>,
	steps: TagStep[]
): RecipeTag[] {
	const tags = new Set<RecipeTag>();

	if (ingredients.length > 0) {
		const all = ingredients.map((ingredient) => contentsOf(ingredient.name));
		const has = (key: keyof Contents) => all.some((contents) => contents[key]);
		if (!has('meat') && !has('fish')) {
			tags.add(has('dairy') || has('egg') || has('honey') ? 'vegetarian' : 'vegan');
		} else if (!has('meat')) {
			tags.add('pescatarian');
		}
		if (!has('gluten')) tags.add('gluten-free');
		if (!has('dairy')) tags.add('dairy-free');
	}

	const minutes = totalMinutes(recipe, steps);
	if (minutes > 0 && minutes <= QUICK_MINUTES) tags.add('quick');
	if (isOnePot(steps)) tags.add('one-pot');

	return RECIPE_TAGS.filter((tag) => tags.has(tag));
}

/** The tags a recipe gets from rules and, once it has judged them, from the model. */
export function combineTags(
	rule: RecipeTag[],
	judged: JudgedTag[] | null
): { tags: RecipeTag[]; tagSource: RecipeTagSource } {
	const all = new Set<RecipeTag>([...rule, ...(judged ?? [])]);
	return {
		tags: RECIPE_TAGS.filter((tag) => all.has(tag)),
		tagSource: { rule, ai: judged }
	};
}

/** The tags that also satisfy a tag: a vegan dish is vegetarian, and both are pescatarian. */
const ALSO_SATISFIED_BY: Partial<Record<RecipeTag, RecipeTag[]>> = {
	vegetarian: ['vegan'],
	pescatarian: ['vegetarian', 'vegan']
};

/** Every tag a recipe may carry to count as `tag`, e.g. vegetarian or vegan for vegetarian. */
export function tagsSatisfying(tag: RecipeTag): RecipeTag[] {
	return [tag, ...(ALSO_SATISFIED_BY[tag] ?? [])];
}

/** True when the recipe's tags count as every wanted tag. */
export function hasTags(tags: readonly RecipeTag[], wanted: readonly RecipeTag[]): boolean {
	return wanted.every((tag) => tagsSatisfying(tag).some((candidate) => tags.includes(candidate)));
}

const DIET_NAMES: Record<string, DietTag> = {
	vegetarian: 'vegetarian',
	veggie: 'vegetarian',
	vegan: 'vegan',
	'plant-based': 'vegan',
	pescatarian: 'pescatarian',
	pescetarian: 'pescatarian',
	'gluten-free': 'gluten-free',
	glutenfree: 'gluten-free',
	coeliac: 'gluten-free',
	celiac: 'gluten-free',
	'dairy-free': 'dairy-free',
	dairyfree: 'dairy-free'
};

/**
 * The diet tags that a household's saved diets require, strictest first: "Vegetarian" and
 * "vegan" require vegan only. Diets the vocabulary has no tag for, such as keto, are ignored.
 */
export function dietTagsFor(diets: ReadonlyArray<string | null | undefined>): DietTag[] {
	const found = new Set<DietTag>();
	for (const diet of diets) {
		if (!diet) continue;
		const key = fold(diet)
			.trim()
			.replace(/[\s_]+/g, '-');
		const tag = DIET_NAMES[key];
		if (tag) found.add(tag);
	}
	if (found.has('vegan')) found.delete('vegetarian');
	if (found.has('vegan') || found.has('vegetarian')) found.delete('pescatarian');
	return DIET_TAGS.filter((tag) => found.has(tag));
}

/**
 * The tags a recipe has: its stored tags, or, before it is tagged, the tags rules give its
 * ingredients and its prep and cook time.
 */
export function tagsOf(recipe: {
	tags: RecipeTag[] | null;
	prepTime: number | null;
	cookTime: number | null;
	ingredients: ReadonlyArray<{ name: string }>;
}): RecipeTag[] {
	return recipe.tags ?? deriveTags(recipe, recipe.ingredients, []);
}

/** "Vegetarian, for your household." or "Vegan and gluten-free, for your household." */
export function dietLine(diets: readonly DietTag[]): string {
	const names = [...diets];
	const listed =
		names.length <= 1
			? names.join('')
			: `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	return `${listed.charAt(0).toUpperCase()}${listed.slice(1)}, for your household.`;
}
